// The world's own clock (pure; Node-testable).
//
// Until now "when" was a by-product of where the camera is: the scroll progress p chose the
// shot, and each shot brought its own sun (chapters.js LIGHT, six art-directed suns; one more
// re-aimed at load on a leaf cluster; one per composition for 06; a counter of frames for
// 06's evening). Nothing outside a shot could say what time it was, so nothing could check
// that two shots show the same day, or that a single take lasts as long as it takes.
//
// Here the question has one answer. A moment is a real instant at the campus (Haikou civil
// time), and everything that depends on time is a pure function of it:
//
//   when      p (and how long 06 has been looked at)  →  an instant            TIMELINE, whenAt
//   sun       an instant  →  where the sun stands over this campus            solarAt (sun.js ephemeris)
//   evening   the sun's height  →  how many classrooms have their lights on    eveningAt
//
// Two paces, and the rule that separates them:
//
//   the tree's time    while the camera looks at the tree (01 → 05, and again while 06 is
//                      held), time is a lapse: each shot is a later day of the same spring at
//                      a later hour. Dates follow the flush (season.js: bare in February, in
//                      full leaf by May), hours follow the day.
//   a person's time    from the moment there is a body (05 → 06, film.js), a second is a
//                      second: the film's 45.4 s are 45.4 s of the same evening. The sun does
//                      not move for the camera's convenience; it moves 0.2°.
//
// The compass comes from the campus (geo.js frame: campus north faces heading 180° + R in
// V4's world) and the campus's own bearing (sun.js SITE.campusNorthBearing). That bearing is
// the project's estimate, not a survey (campus.json: orientation unverified; its source note
// gives a different figure, 41.4°). It is one constant, read here only: when the original KML
// is recovered, every shadow in the world follows from changing it.
import { sunPosition, haikouToMs, haikouParts, dayOfYearFor, formatClock, SITE } from '../js/sun.js';

const R2D = 180 / Math.PI;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const wrap360 = (a) => ((a % 360) + 360) % 360;

export const YEAR = 2026;
/** the film's own length (film.js FILM_SECONDS; passed in by the caller so this module stays free of it) */
export const FILM_SECONDS_DEFAULT = 45.4;

/**
 * One knot per shot: the day and the hour it shows. Chosen once, from the tree and the sky:
 *   dates   the flush (season.js CURVES.flush) at the growth each shot shows (chapters.js GROW)
 *   hours   01 the sun 8° up, as V4 lit it; 02 and 03 the morning climbing; 04 the afternoon, the
 *           sun low enough to lay the crown's shadow beside it; 06 the instant the real sun stands
 *           where composition b needs it (heading 320°, 8.6° up: 15 May, 18:25), so the walker's
 *           shadow lies towards the trunk without the sun being moved there
 * 05 is 06 minus the film: the same evening, one take earlier.
 */
export const TIMELINE = [
  { p: 0, month: 2, day: 24, minutes: 7 * 60 + 41 },    // 01 end of winter, just after sunrise
  { p: 1, month: 3, day: 8, minutes: 9 * 60 },          // 02 buds; the morning under the limbs
  { p: 2, month: 3, day: 19, minutes: 10 * 60 },        // 03 the new leaves, mid-morning
  { p: 3, month: 4, day: 15, minutes: 16 * 60 },        // 04 from above, mid-afternoon
  { p: 5, month: 5, day: 15, minutes: 18 * 60 + 25 }    // 06 the evening the film ends in (05 = this − the film)
];

/** 06 held: the tree's time again. One second of looking is this many seconds of the evening. */
export const HOLD_LAPSE = 96;
/** the evening stops here: the walker's shadow (06 stands 26.5 m from the trunk) has by then grown across the
 *  paving onto the rocks at the tree's foot, and the low light still draws it (lower, the ground's own light is
 *  too weak to show a shadow at all; night is not lit yet) */
export const LAST_LIGHT_EL = 4.4;
/** classrooms: none lit while the sun is this high, all lit when it is this low (degrees) */
export const LIGHTS_FROM_EL = 8.5, LIGHTS_FULL_EL = 5.6;

const knotMs = (k) => haikouToMs(YEAR, dayOfYearFor(k.month, k.day), k.minutes);
const quintic = (f) => f * f * f * (f * (f * 6 - 15) + 10);

/**
 * The instant shown at scroll progress p (0 … 5), with `held` seconds of looking at 06.
 * Monotonic in p and in held. Returns epoch ms and the Haikou calendar parts.
 *   filmSeconds  film.js FILM_SECONDS: p ∈ [4, 5] is that many seconds, linearly (a person's time)
 */
export function whenAt(p, { held = 0, filmSeconds = FILM_SECONDS_DEFAULT } = {}) {
  const q = clamp(p, 0, 5);
  const end = knotMs(TIMELINE[TIMELINE.length - 1]);
  const t05 = end - filmSeconds * 1000;
  let ms, dayFrac = 0;
  if (q >= 4) ms = t05 + (q - 4) * filmSeconds * 1000;                     // a person's time: linear, 1 s = 1 s
  else {
    // the tree's time: the day of the year and the hour of the day each ease from shot to shot
    // (a shot holds its own light, as chapters.js lightAt does), so neither runs backwards
    const i = Math.min(3, Math.floor(q)), f = q - i, t = quintic(f);
    const a = TIMELINE[i], b = i === 3 ? null : TIMELINE[i + 1];
    const d0 = dayOfYearFor(a.month, a.day), m0 = a.minutes;
    let d1, m1;
    if (b) { d1 = dayOfYearFor(b.month, b.day); m1 = b.minutes; }
    else { const e = haikouParts(t05); d1 = e.dayOfYear; m1 = e.minutes; }   // 04 → 05: on to the evening of the film
    // the instant is that hour on that whole day; the part of a day left over only blends the
    // sun's place between this day's and the next's (solarAt), so the hour is never shifted by it
    const d = d0 + (d1 - d0) * t, whole = Math.floor(d + 1e-9);
    dayFrac = clamp(d - whole, 0, 1);
    ms = haikouToMs(YEAR, whole, m0 + (m1 - m0) * t);
  }
  // 06 held: the evening goes on at the tree's pace, until the last light
  if (held > 0 && q > 4.93) ms += lapseMs(held, end) * smoothstep((q - 4.93) / 0.07);
  return describe(ms, dayFrac);
}

const smoothstep = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
let lastLight = null;
/** ms after the film's last frame at which the sun reaches LAST_LIGHT_EL (found once) */
function lastLightMs(end) {
  if (lastLight && lastLight.end === end) return lastLight.ms;
  let lo = 0, hi = 3600e3;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (sunPosition(end + m).altitude * R2D > LAST_LIGHT_EL) lo = m; else hi = m; }
  lastLight = { end, ms: lo };
  return lo;
}
/** the evening that has gone by after `held` seconds of looking: eases into its end (never past it) */
function lapseMs(held, end) {
  const max = lastLightMs(end), x = (held * HOLD_LAPSE * 1000) / max;
  return max * (1 - Math.exp(-x));                 // starts at HOLD_LAPSE× and comes to rest at the last light
}
/** seconds of looking after which the evening has all but reached its last light (for interfaces and tests) */
export function holdSecondsToDusk() { return (lastLightMs(knotMs(TIMELINE[TIMELINE.length - 1])) / (HOLD_LAPSE * 1000)) * 3; }

/** an instant as the campus's own calendar and clock reads it */
export function describe(ms, dayFrac = 0) {
  const h = haikouParts(ms);
  return { ms, dayFrac, month: h.month, day: h.day, dayOfYear: h.dayOfYear + dayFrac, minutes: h.minutes, clock: formatClock(h.minutes), label: `${h.month}月${h.day}日 ${formatClock(h.minutes)}` };
}

/** world heading (degrees, atan2(x, z), chapters.js convention) of true north, for a campus turned by `rotation` */
export function northHeading(rotation = 0, northBearing = SITE.campusNorthBearing) {
  return wrap360(180 + rotation * R2D + northBearing);
}

/**
 * Where the sun stands over the campus at an instant, in V4's world.
 *   rotation  the composition's campus → world rotation (compose.js; radians)
 * Returns { sunAz, sunEl } as chapters.js lightAt names them (degrees), plus the compass bearing.
 */
export function solarAt(when, rotation = 0, northBearing = SITE.campusNorthBearing) {
  const ms = typeof when === 'number' ? when : when.ms, k = typeof when === 'number' ? 0 : when.dayFrac || 0;
  const s = sunPosition(ms);
  let bearing = s.bearing, alt = s.altitude;
  if (k > 0) {                                   // between two days of the lapse: the same hour, a day on
    const n = sunPosition(ms + 86400000);
    bearing += (((n.bearing - s.bearing + 540) % 360) - 180) * k;
    alt += (n.altitude - s.altitude) * k;
  }
  return { sunAz: wrap360(northHeading(rotation, northBearing) - bearing), sunEl: alt * R2D, bearing: wrap360(bearing) };
}

/** how many of the classrooms have their lights on (0 … 1) with the sun `sunEl` degrees up (after noon only) */
export function eveningAt(sunEl, minutes = 1080) { return minutes < 720 ? 0 : smoothstep((LIGHTS_FROM_EL - sunEl) / (LIGHTS_FROM_EL - LIGHTS_FULL_EL)); }
/** how far the evening has gone from the film's last frame to the last light (0 … 1): what the dusk grade follows */
export function duskAt(sunEl, minutes = 1080, fromEl = 8.6) { return minutes < 720 ? 0 : clamp((fromEl - sunEl) / (fromEl - LAST_LIGHT_EL), 0, 1); }

/**
 * A clock for one page: the composition's compass, the film's length, and how long 06 has been held.
 * `held` is the only thing it remembers; every reading is a pure function of (p, held).
 */
export function createClock({ rotation = 0, filmSeconds = FILM_SECONDS_DEFAULT, northBearing = SITE.campusNorthBearing } = {}) {
  const C = {
    rotation, filmSeconds, northBearing,
    /** seconds 06 has been looked at (walking counts: the evening does not wait) */
    held: 0,
    when(p) { return whenAt(p, { held: C.held, filmSeconds }); },
    sun(p) { return solarAt(C.when(p), rotation, northBearing); },
    evening(p) { return C.at(p).evening; },
    /** the whole reading at p: instant, sun, lights, dusk */
    at(p) { const w = C.when(p), s = solarAt(w, rotation, northBearing); return { ...w, ...s, evening: eveningAt(s.sunEl, w.minutes), dusk: duskAt(s.sunEl, w.minutes) }; },
    /** the sun at the evening's last light (where 06's shadow ends up pointing) */
    lastLight() { const end = knotMs(TIMELINE[TIMELINE.length - 1]); return solarAt(end + lastLightMs(end), rotation, northBearing); },
    /** let `dt` seconds of looking go by (06 held, or walking); leaving 06 backwards lets the evening go */
    hold(dt) { C.held = Math.min(C.held + dt, 600); },
    /** away from 06 the held evening is let go: at once, or eased over frames of dt seconds (no jump in the light) */
    release(dt = 0) { C.held = dt > 0 ? C.held * Math.exp(-3 * dt) : 0; if (C.held < 0.02) C.held = 0; }
  };
  return C;
}
