// 抽出一年 · the paper the trunk lies on, and the sky a day opens into.
//
// Everything about the day is computed or read, as in HAIZ's 年轮:
//   sun / moon   lanren/js/sun.js and lanren/rings/almanac.js (ephemerides, ≪ 1°)
//   cloud, rain, wind   that day's ERA5 row (daily values: the same all day long)
// The colours of the sky are art direction keyed to the sun's height, not a measurement.
import { sunPosition } from './lib/js/sun.js';
import { msOf, moonAt } from './lib/rings/almanac.js';
import { clamp, lerp, smooth } from './physics.js';

const RAD = Math.PI / 180;
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const css = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

// sun height (deg) → zenith, horizon
const SKY = [
  { a: -18, z: hex('#070b16'), h: hex('#121a2e') },
  { a: -8, z: hex('#141a38'), h: hex('#4a3a58') },
  { a: -2, z: hex('#2c3a6e'), h: hex('#d27f5e') },
  { a: 4, z: hex('#43629e'), h: hex('#f2b47c') },
  { a: 14, z: hex('#4e7fbe'), h: hex('#f2d6ad') },
  { a: 35, z: hex('#3876c4'), h: hex('#b9d5ea') },
  { a: 90, z: hex('#2f6cc0'), h: hex('#aecfea') }
];
function skyAt(alt) {
  const a = clamp(alt, -18, 90);
  let i = 0;
  while (i < SKY.length - 2 && a > SKY[i + 1].a) i++;
  const A = SKY[i], B = SKY[i + 1], t = smooth(A.a, B.a, a);
  return { z: mix(A.z, B.z, t), h: mix(A.h, B.h, t) };
}

export const PAPER = hex('#efe8da');

let grain = null;
function paperGrain(ctx) {
  if (grain) return grain;
  const c = document.createElement('canvas');
  c.width = c.height = 160;
  const g = c.getContext('2d');
  const img = g.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 120 + Math.random() * 60;
    img.data[i] = v; img.data[i + 1] = v * 0.95; img.data[i + 2] = v * 0.85; img.data[i + 3] = 16;
  }
  g.putImageData(img, 0, 0);
  grain = ctx.createPattern(c, 'repeat');
  return grain;
}

/** the colour a day leaves on the paper while you look at it: warm days warm it, wet days cool it */
export function dayTint(row) {
  if (!row || row.tmax == null) return PAPER;
  const t = clamp(((row.tmax + row.tmin) / 2 - 14) / 17);
  let c = mix(hex('#dfe6ea'), hex('#f3dcc0'), t);
  const wet = clamp(Math.log1p(row.rain || 0) / Math.log1p(120));
  c = mix(c, hex('#b9c4cc'), wet * 0.8);
  return c;
}

const rnd = (seed) => { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };

/** where the sun is drawn: minutes after midnight → screen point (also used for hit-testing the arc) */
export function sunPoint(w, horizon, date, minutes) {
  const p = sunPosition(msOf(date.y, date.m, date.d, minutes));
  const alt = p.altitude / RAD;
  const x = lerp(w * 0.07, w * 0.93, minutes / 1440);
  const y = horizon - Math.sin(Math.max(-0.35, p.altitude)) * horizon * 0.8;
  return { x, y, alt };
}

/**
 * Paint one frame.
 * s = { w, h, tint, reveal (0..1), from: {x,y,w,h} (the day's cell), day: { date, row, minutes, horizon }, time }
 */
export function paint(ctx, s) {
  const { w, h } = s;
  ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
  // paper
  const tint = s.tint || PAPER;
  const g = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.5, Math.hypot(w, h) * 0.65);
  g.addColorStop(0, css(mix(PAPER, tint, 0.55)));
  g.addColorStop(1, css(mix(mix(PAPER, tint, 0.4), hex('#c9bca4'), 0.55)));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = paperGrain(ctx);
  ctx.fillRect(0, 0, w, h);
  if (!s.day || s.reveal <= 0.001) return;

  // the day: a sky that grows out of one cell of the band
  const p = clamp(s.reveal);
  const f = s.from;
  const x0 = lerp(f.x, 0, p), y0 = lerp(f.y, 0, p), x1 = lerp(f.x + f.w, w, p), y1 = lerp(f.y + f.h, h, p);
  const rad = lerp(Math.min(f.w, f.h) / 2, 0, smooth(0.6, 1, p));
  ctx.save();
  ctx.globalAlpha = smooth(0, 0.3, p);   // a small cell of sky melts into the wood instead of reading as a hole
  ctx.beginPath();
  ctx.roundRect(x0, y0, x1 - x0, y1 - y0, rad);
  ctx.clip();
  paintDay(ctx, w, h, s.day, s.time);
  ctx.restore();
}

function paintDay(ctx, w, h, day, time) {
  const { date, row, minutes, horizon } = day;
  const sun = sunPoint(w, horizon, date, minutes);
  const has = !!row && row.tmax != null;
  const cloud = has && row.cloud != null ? row.cloud / 100 : 0.3;
  const mm = has && row.rain != null ? row.rain : 0;
  const rain = mm < 0.5 ? 0 : clamp(Math.log1p(mm) / Math.log1p(150), 0.1, 1);
  const wind = has && row.wind != null ? row.wind : 10;
  const gust = has && row.gust != null ? row.gust : wind * 1.5;
  const over = clamp(Math.pow(cloud, 1.5) * 0.75 + rain * 0.55);
  const night = 1 - smooth(-10, -1, sun.alt);
  let { z, h: hz } = skyAt(sun.alt);
  const grey = mix(hex('#8d969c'), hex('#1d2126'), night);
  z = mix(z, mix(grey, hex('#000000'), 0.15), over * 0.85);
  hz = mix(hz, grey, over * 0.75);
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, css(z));
  sky.addColorStop(1, css(hz));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizon + 1);

  // stars on a clear night
  if (night > 0.2 && over < 0.7) {
    const r = rnd(date.y * 400 + date.m * 31 + date.d);
    ctx.fillStyle = `rgba(255,250,235,${(night - 0.2) * (1 - over) * 0.9})`;
    for (let i = 0; i < 160; i++) {
      const x = r() * w, y = r() * horizon * 0.92, s = r() < 0.08 ? 1.6 : 0.8;
      ctx.fillRect(x, y, s, s);
    }
  }

  // the day's ring: the path the sun really takes over the campus on this date
  ctx.save();
  ctx.setLineDash([2, 6]);
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = night > 0.5 ? 'rgba(255,240,210,0.28)' : 'rgba(255,250,235,0.55)';
  ctx.beginPath();
  let started = false;
  for (let m = 0; m <= 1440; m += 6) {
    const q = sunPoint(w, horizon, date, m);
    if (q.alt < -0.8) { started = false; continue; }
    if (!started) { ctx.moveTo(q.x, q.y); started = true; } else ctx.lineTo(q.x, q.y);
  }
  ctx.stroke();
  ctx.restore();

  // the sun, or the moon
  if (sun.alt > -3) {
    const glow = ctx.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, 140);
    const warm = 1 - smooth(2, 25, sun.alt);
    const sc = mix(hex('#fff6dc'), hex('#ffb070'), warm);
    glow.addColorStop(0, css(sc, 0.65 * (1 - over * 0.7)));
    glow.addColorStop(1, css(sc, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(sun.x - 140, sun.y - 140, 280, 280);
    ctx.fillStyle = css(mix(sc, hex('#ffffff'), 0.4), 1 - over * 0.75);
    ctx.beginPath(); ctx.arc(sun.x, sun.y, 13, 0, Math.PI * 2); ctx.fill();
  }
  const moon = moonAt(msOf(date.y, date.m, date.d, minutes));
  const malt = moon.altitude / RAD;
  if (malt > 0 && sun.alt < 8) {
    const mx = lerp(w * 0.15, w * 0.85, ((moon.bearing - 60 + 360) % 360) / 240);
    const my = horizon - Math.sin(moon.altitude) * horizon * 0.8;
    const a = (1 - over * 0.8) * (0.4 + 0.6 * night);
    const R = 11;
    const waxing = moon.phase < 0.5;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(255,248,225,1)';
    ctx.beginPath(); ctx.arc(mx, my, R, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // phase as a shadow ellipse
    ctx.save();
    ctx.globalAlpha = a * 0.92;
    ctx.fillStyle = css(z);
    ctx.beginPath();
    const lit = moon.fraction;
    if (lit < 0.97) {
      ctx.arc(mx, my, R + 0.5, -Math.PI / 2, Math.PI / 2, waxing);
      ctx.ellipse(mx, my, R * Math.abs(1 - 2 * lit), R + 0.5, 0, Math.PI / 2, -Math.PI / 2, lit > 0.5 ? waxing : !waxing);
      ctx.fill();
    }
    ctx.restore();
  }

  // clouds, drifting with the day's wind
  const dirRad = ((has && row.dir != null ? row.dir : 90) + 180) * RAD;   // wind blows *from* dir
  const drift = (Math.sin(dirRad) >= 0 ? 1 : -1) * (6 + wind * 0.9);
  const rc = rnd(date.y * 977 + date.m * 37 + date.d * 3);
  const nCloud = Math.round(3 + cloud * 26);
  for (let i = 0; i < nCloud; i++) {
    const baseX = rc() * (w + 400) - 200, y = horizon * (0.08 + rc() * 0.72), sz = 60 + rc() * 160 * (0.6 + cloud);
    const x = ((baseX + time * drift * (0.6 + rc() * 0.6)) % (w + 400) + (w + 400)) % (w + 400) - 200;
    const lit = mix(mix(hex('#ffffff'), hz, 0.35), hex('#5b6268'), over * 0.7 + night * 0.5);
    const cg = ctx.createRadialGradient(x, y, 0, x, y, sz);
    cg.addColorStop(0, css(lit, 0.42 * (0.35 + cloud)));
    cg.addColorStop(1, css(lit, 0));
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.ellipse(x, y, sz * 1.6, sz * 0.55, 0, 0, Math.PI * 2); ctx.fill();
  }

  // ground, under the band
  const gr = ctx.createLinearGradient(0, horizon, 0, h);
  const gcol = mix(mix(hex('#4d5a3c'), hex('#0d120e'), night), grey, over * 0.3);
  gr.addColorStop(0, css(mix(gcol, hz, 0.35)));
  gr.addColorStop(1, css(mix(gcol, hex('#000000'), 0.45)));
  ctx.fillStyle = gr;
  ctx.fillRect(0, horizon, w, h - horizon);

  // rain, leaning with the wind
  if (rain > 0) {
    const n = Math.round(80 + rain * 520);
    const lean = clamp(gust / 120, 0, 1) * 0.7 * (drift > 0 ? 1 : -1);
    const r = rnd(date.d * 13 + date.m * 101);
    ctx.strokeStyle = `rgba(220,232,240,${0.18 + rain * 0.3})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const speed = 700 + r() * 500;
      const len = 10 + rain * 22;
      const x = (r() * (w + 200) - 100 + lean * speed * ((time + r() * 10) % 1.4)) % (w + 200);
      const y = ((r() * h + speed * time) % (h + 40)) - 20;
      ctx.moveTo(x, y); ctx.lineTo(x + lean * len, y + len);
    }
    ctx.stroke();
  }
}
