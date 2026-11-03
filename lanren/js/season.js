// A phenology model for Terminalia catappa at Haikou (20°N).
//
// What the sources say (see docs/lanren-20261103.md):
//   * leaves are crowded at the shoot tips; they turn red / yellow before falling
//   * in most of its range the tree sheds its leaves once or twice a year,
//     e.g. Jan–Feb and Jul–Aug in Singapore (Corner, via species profiles)
//   * fruit: a drupe, green when young, yellow to red when ripe
// What is our interpretation (not an observation of this particular tree):
//   * Haikou has a cooler dry winter, so the main red display is placed in
//     December–February, followed by bare branches and a new flush in March;
//   * a smaller summer turnover touches ~14% of leaves in July–August;
//   * flowering spikes in spring, fruit from July, ripening into autumn.
// The model is deliberately smooth and continuous so a viewer can scrub the
// year without visual jumps; every state it returns is labelled "推演".
// Pure module: no DOM.

const K = (m, d) => [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334][m - 1] + d;

// [dayOfYear, value(, 'step')]; evaluated cyclically with smooth (cosine) easing.
// A 'step' key jumps instead of easing: used for invisible resets, where the
// state before and after looks identical on the tree (see notes).
const CURVES = {
  // old-leaf senescence: 0 green … ~1.38 every old leaf has fallen
  turn: [[K(1, 1), 0.62], [K(1, 20), 0.92], [K(2, 5), 1.15], [K(2, 25), 1.36], [K(3, 20), 1.40],
         [K(5, 1), 1.40], [K(5, 1), 0.0, 'step'], [K(10, 20), 0.0], [K(11, 15), 0.12], [K(12, 10), 0.36]],
  // growth of the new flush after leaf fall: 0 none … 1 mature
  flush: [[K(1, 1), 0], [K(2, 15), 0], [K(3, 5), 0.25], [K(3, 25), 0.6], [K(4, 15), 0.88],
          [K(5, 1), 1], [K(11, 2), 1], [K(11, 2), 0, 'step']],
  // summer turnover phase for a minority of leaves: 0..1 colouring, 1..2 regrowth
  summer: [[K(6, 20), 0], [K(7, 20), 0.75], [K(8, 8), 1.15], [K(8, 30), 1.6], [K(9, 26), 2.05],
           [K(9, 26), 0, 'step']],
  fruit: [[K(1, 1), 0.05], [K(1, 20), 0], [K(6, 15), 0], [K(7, 15), 0.55], [K(8, 30), 1],
          [K(10, 31), 0.9], [K(12, 1), 0.35]],
  ripe: [[K(1, 1), 1], [K(6, 15), 0], [K(7, 15), 0], [K(9, 15), 0.4], [K(10, 31), 0.85], [K(12, 1), 1]],
  flowers: [[K(1, 1), 0], [K(3, 1), 0], [K(4, 1), 0.8], [K(5, 15), 1], [K(6, 15), 0.4], [K(7, 10), 0]]
};

function evalCurve(keys, doy, yearDays = 365) {
  const n = keys.length;
  for (let i = 0; i < n; i++) {
    const [d0, v0] = keys[i];
    const [d1raw, v1] = keys[(i + 1) % n];
    const d1 = i + 1 < n ? d1raw : d1raw + yearDays;
    let x = doy;
    if (i + 1 >= n && x < d0) x += yearDays;
    if (x >= d0 && x < d1) {
      if (keys[(i + 1) % n][2] === 'step') return v0;
      const t = (x - d0) / (d1 - d0);
      const e = 0.5 - 0.5 * Math.cos(Math.PI * t);
      return v0 + (v1 - v0) * e;
    }
  }
  // before the first key: interpolate from the last key of the previous year
  const [dl, vl] = keys[n - 1];
  const [df, vf] = keys[0];
  const t = (doy + yearDays - dl) / (df + yearDays - dl);
  const e = 0.5 - 0.5 * Math.cos(Math.PI * t);
  return vl + (vf - vl) * e;
}

export function seasonAt(doy, yearDays = 365) {
  const s = {};
  for (const k of Object.keys(CURVES)) s[k] = evalCurve(CURVES[k], doy, yearDays);
  // Expected fraction of old leaves already fallen, mirroring the shader:
  // oldAge = clamp((turn - r1*0.85) * 2.2)  → gone when turn - 0.85 r1 >= 1/2.2
  const thr = s.turn - 1 / 2.2;
  s.fallen = Math.max(0, Math.min(1, thr / 0.85));
  s.reddening = Math.max(0, Math.min(1, (s.turn * 2.2) / 2.2));
  // leaves per minute that detach (drives falling leaves and the ground litter)
  const dTurn = Math.max(0, evalCurve(CURVES.turn, doy + 1, yearDays) - s.turn);
  const dSum = Math.max(0, evalCurve(CURVES.summer, doy + 1, yearDays) - s.summer);
  s.fallRate = 0.35 + dTurn * 160 + (s.summer > 0.7 && s.summer < 1.4 ? dSum * 30 : 0);
  // fallen leaves on the ground (before the morning sweep), 0..1
  s.litter = Math.min(1, 0.08 + dTurn * 40 + (s.summer > 0.8 && s.summer < 1.3 ? 0.18 : 0));
  s.label = describe(s);
  return s;
}

export function describe(s) {
  if (s.flush > 0 && s.flush < 0.92 && s.fallen > 0.6) return s.flush < 0.15 ? '枝头将要萌芽' : '新叶正在长出';
  if (s.fallen > 0.85) return '叶已落尽';
  if (s.fallen > 0.25) return '红叶纷落';
  if (s.turn > 0.55) return '满树转红';
  if (s.turn > 0.08) return '零星红叶';
  if (s.summer > 0.4 && s.summer < 1.6) return '夏季换叶';
  if (s.flowers > 0.45) return '浓荫 · 花穗';
  if (s.fruit > 0.45) return '浓荫 · 挂果';
  return '浓荫';
}

// The colour stage of an individual leaf (age 0..1), shared with the specimen card
export function stageName(age, young) {
  if (young > 0.4) return '新绿';
  if (age < 0.12) return '深绿';
  if (age < 0.35) return '黄绿';
  if (age < 0.55) return '橙黄';
  if (age < 0.8) return '绯红';
  if (age < 0.95) return '深红';
  return '赭褐';
}

// Same colour math as the leaf shader, in linear RGB (used for the 2D card)
export const LEAF_PALETTE = {
  green: [0.042, 0.092, 0.024],
  green2: [0.062, 0.118, 0.030],
  yellow: [0.60, 0.40, 0.045],
  red: [0.42, 0.035, 0.018],
  brown: [0.17, 0.075, 0.03],
  young: [0.30, 0.42, 0.07]
};

export function leafColour(age, sen, young = 0, variant = 0) {
  const P = LEAF_PALETTE;
  const a = age * 1.35;
  const cl = (x) => Math.max(0, Math.min(1, x));
  const ss = (e0, e1, x) => { const t = cl((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
  const k1 = ss(sen, sen + 0.16, a);
  const k2 = ss(sen + 0.30, sen + 0.46, a);
  const k3 = ss(sen + 0.95, sen + 1.2, a);
  const mix = (x, y, t) => x.map((v, i) => v + (y[i] - v) * t);
  let c = mix(P.green, P.green2, variant);
  c = mix(c, P.yellow, k1);
  c = mix(c, P.red, k2);
  c = mix(c, P.brown, k3);
  c = mix(c, P.young, young);
  return c;
}

export { CURVES, evalCurve };
