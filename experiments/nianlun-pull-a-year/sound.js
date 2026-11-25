// 抽出一年 · small wooden sounds, synthesised (no recordings).
// Days clicking past under the lens, fibres giving way as a ring is pulled, a knock for
// every month the scroll lays down. Quiet by default, off with one tap, remembered per browser.
let ctx = null, master = null, noise = null, last = 0;
let on = true;
try { on = localStorage.getItem('nianlun-sound') !== 'off'; } catch (_) { /* storage blocked */ }

function ensure() {
  if (ctx || !on) return ctx;
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.5;
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
function tone(f0, f1, dur, gain) {
  if (!on || !ensure()) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
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
    try { localStorage.setItem('nianlun-sound', on ? 'on' : 'off'); } catch (_) { /* storage blocked */ }
    if (on) { ensure(); ctx && ctx.resume(); }
    return on;
  },
  /** call from a user gesture: browsers only start audio after one */
  wake() { if (on && ensure() && ctx.state === 'suspended') ctx.resume(); },
  /** a day passing under the lens */
  tick(strong = false) {
    const now = performance.now();
    if (now - last < 22) return;
    last = now;
    burst({ freq: strong ? 1500 : 2600 + Math.random() * 500, gain: strong ? 0.07 : 0.035, decay: strong ? 0.04 : 0.016 });
  },
  /** fibres giving way while a ring is pulled */
  fibre(t) { burst({ freq: 900 + t * 1400 + Math.random() * 300, q: 3, gain: 0.02 + 0.03 * t, decay: 0.03 }); },
  /** the ring comes free */
  pop() { tone(220, 70, 0.16, 0.12); burst({ freq: 1200, q: 2, gain: 0.08, decay: 0.06 }); },
  /** a month laid down by the rolling scroll */
  knock(i) { tone(150 + (i % 3) * 12, 90, 0.09, 0.07); burst({ freq: 700, q: 4, gain: 0.04, decay: 0.05 }); },
  /** a day opening, or folding back */
  breath(open) {
    if (!on || !ensure()) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noise; src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 0.7;
    lp.frequency.setValueAtTime(open ? 300 : 1800, t);
    lp.frequency.exponentialRampToValueAtTime(open ? 2400 : 250, t + 0.6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    src.connect(lp).connect(g).connect(master);
    src.start(t); src.stop(t + 0.75);
  }
};
