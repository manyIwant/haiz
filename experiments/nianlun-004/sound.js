// NIANLUN 004 · synthesized acoustic materials (zero recordings).
// Extends PR #114's wooden acoustics with subtle bamboo, cotton-paper, cinnabar-seal,
// and conflict-warning micro-sounds. Quiet by default, one-tap mute, remembered locally.
let ctx = null, master = null, noise = null, last = 0;
let on = true;
try { on = localStorage.getItem('nianlun004-sound') !== 'off'; } catch (_) { /* storage blocked */ }

function ensure() {
  if (ctx || !on) return ctx;
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.45;
  master.connect(ctx.destination);
  const len = ctx.sampleRate * 0.5;
  noise = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return ctx;
}

function burst({ freq = 2400, q = 6, gain = 0.05, decay = 0.018, delay = 0 }) {
  if (!on || !ensure()) return;
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  src.connect(bp).connect(g).connect(master);
  src.start(t, Math.random() * 0.4, decay + 0.02);
}

function tone(f0, f1, dur, gain, delay = 0, type = 'sine') {
  if (!on || !ensure()) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

export const sound = {
  get on() { return on; },
  toggle() {
    on = !on;
    try { localStorage.setItem('nianlun004-sound', on ? 'on' : 'off'); } catch (_) { /* storage blocked */ }
    if (on) { ensure(); ctx && ctx.resume(); }
    return on;
  },
  wake() { if (on && ensure() && ctx.state === 'suspended') ctx.resume(); },
  /** A day or ring passing under the lens */
  tick(strong = false) {
    const now = performance.now();
    if (now - last < 22) return;
    last = now;
    burst({ freq: strong ? 1500 : 2600 + Math.random() * 500, gain: strong ? 0.07 : 0.032, decay: strong ? 0.04 : 0.015 });
  },
  /** Wood fibres resisting as a ring is pulled */
  fibre(t) { burst({ freq: 900 + t * 1400 + Math.random() * 300, q: 3, gain: 0.02 + 0.03 * t, decay: 0.03 }); },
  /** Ring releases from trunk */
  pop() { tone(220, 70, 0.16, 0.12); burst({ freq: 1200, q: 2, gain: 0.08, decay: 0.06 }); },
  /** Month knock during hand-scroll unroll */
  knock(i) { tone(150 + (i % 3) * 12, 90, 0.09, 0.07); burst({ freq: 700, q: 4, gain: 0.04, decay: 0.05 }); },
  /** Day opening / closing breath */
  breath(open) {
    if (!on || !ensure()) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noise; src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 0.7;
    lp.frequency.setValueAtTime(open ? 300 : 1800, t);
    lp.frequency.exponentialRampToValueAtTime(open ? 2400 : 250, t + 0.55);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.055, t + 0.14);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.62);
    src.connect(lp).connect(g).connect(master);
    src.start(t); src.stop(t + 0.68);
  },
  /** Peeling a secondary material ribbon (paper / bamboo rustle) */
  peel(open = true) {
    burst({ freq: open ? 1900 : 1200, q: 1.8, gain: 0.045, decay: 0.08 });
    tone(open ? 310 : 420, open ? 440 : 280, 0.08, 0.035, 0.02);
  },
  /** Bamboo slat tap (course / period) */
  bamboo() { tone(620, 460, 0.06, 0.05, 0, 'triangle'); burst({ freq: 2100, q: 5, gain: 0.03, decay: 0.025 }); },
  /** Cotton paper slip snap (homework completed or dropped into schedule) */
  snap() { burst({ freq: 3100, q: 2.5, gain: 0.04, decay: 0.03 }); tone(420, 660, 0.09, 0.05, 0.015); },
  /** Cinnabar exam seal extract */
  seal() { tone(165, 92, 0.14, 0.085); burst({ freq: 800, q: 3, gain: 0.04, decay: 0.05, delay: 0.01 }); },
  /** Soft wooden double-tap for detected schedule conflict */
  conflict() { tone(280, 210, 0.08, 0.06); tone(240, 180, 0.1, 0.06, 0.09); }
};
