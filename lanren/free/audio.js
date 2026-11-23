// HAIZ · 自由共游 — what it sounds like. Everything synthesised (Web Audio), nothing loaded; after Petalwake's
// rule (its audio.js) that nothing should hold a pitch for long — a continuous tone reads as a whine. So
// the beds are noise shaped by filters that follow the motion, and the only pitched sounds are events:
//
//   air       pink noise, low-passed and swelling with speed (a bike barely; a broom at full tilt, a
//             rush), with slow gusts
//   rolling   tyres hiss, louder and rougher on grass; a skateboard's wheels rumble, with the click of
//             each joint in the paving passing under them; a bike coasting ticks its freewheel
//   events    the bicycle bell (two strikes of inharmonic partials), a kick's scuff, an ollie's pop and
//             the clack of the landing, the swish of leaves when the broom goes through a crown, a soft
//             thump when something is bumped
// Starts on the first touch or key (browsers require it); the 声 button mutes.
export function createAudio() {
  let ctx = null, master = null, muted = false;
  const N = {};
  function start() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3;
    master.connect(comp).connect(ctx.destination);
    master.gain.linearRampToValueAtTime(muted ? 0 : 0.85, ctx.currentTime + 1.5);
    // a shared noise buffer (pink-ish, Paul Kellet's economy filter)
    const len = ctx.sampleRate * 3, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.18; }
    N.buf = buf;
    const bed = (type, freq, q) => {
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.playbackRate.value = 0.9 + Math.random() * 0.2;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(f).connect(g).connect(master); src.start(ctx.currentTime + Math.random());
      return { f, g };
    };
    N.air = bed('lowpass', 400, 0.4);
    N.rush = bed('bandpass', 900, 0.7);
    N.roll = bed('bandpass', 2400, 0.9);
    N.rumble = bed('lowpass', 180, 0.8);
    N.leaves = bed('highpass', 3500, 0.5);
  }
  const once = () => { start(); removeEventListener('pointerdown', once); removeEventListener('keydown', once); };
  addEventListener('pointerdown', once); addEventListener('keydown', once);

  const set = (p, v, tc = 0.12) => { if (ctx) p.setTargetAtTime(v, ctx.currentTime, tc); };
  // ---- events
  function burst({ dur = 0.08, freq = 1200, q = 1, gain = 0.3, type = 'bandpass', at = 0 }) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource(); src.buffer = N.buf; src.playbackRate.value = 1 + Math.random() * 0.3;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(f).connect(g).connect(master); src.start(t, Math.random() * 2); src.stop(t + dur + 0.05);
  }
  function thump(freq = 90, gain = 0.4, dur = 0.18, at = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(freq * 1.6, t); o.frequency.exponentialRampToValueAtTime(freq, t + dur * 0.4);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function bell() {
    if (!ctx || muted) return;
    // a thumb-struck bicycle bell: inharmonic partials, a quick decay, struck twice
    for (const at of [0, 0.16]) {
      const t = ctx.currentTime + at;
      for (const [r, a, d] of [[1, 0.22, 1.1], [2.76, 0.12, 0.7], [5.4, 0.06, 0.4], [8.93, 0.03, 0.25]]) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = 2350 * r / 2.76 * (1 + (Math.random() - 0.5) * 0.004);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0005, t + d);
        o.connect(g).connect(master); o.start(t); o.stop(t + d + 0.05);
      }
      burst({ dur: 0.03, freq: 5000, q: 2, gain: 0.08, at });
    }
  }
  // ---- per frame
  let tick = 0, joint = 0, gust = 0, gt = 0;
  function update(dt, s) {
    if (!ctx || !N.air) return;
    gt += dt; gust += ((Math.sin(gt * 0.31) * 0.5 + 0.5) * (Math.sin(gt * 0.17 + 1) * 0.5 + 0.5) - gust) * dt;
    const v = s.speed, m = s.mode;
    const air = m === 'broom' ? Math.min(1, v / 20) : Math.min(0.5, v / 14);
    set(N.air.g.gain, 0.05 + air * air * 0.5 + gust * 0.04);
    set(N.air.f.frequency, 300 + air * 1600);
    set(N.rush.g.gain, m === 'broom' ? air * air * 0.35 + (s.boost || 0) * 0.08 : 0);
    set(N.rush.f.frequency, 600 + v * 60);
    const ground = (m === 'bike' || m === 'board') ? 1 : 0;
    const lawn = s.surface === 'lawn';
    set(N.roll.g.gain, m === 'bike' ? Math.min(0.12, v * 0.018) * (lawn ? 1.6 : 1) : 0);
    set(N.roll.f.frequency, lawn ? 1300 : 2600);
    set(N.rumble.g.gain, m === 'board' && !s.air ? Math.min(0.5, v * 0.08) * (lawn ? 0.4 : 1) : 0);
    set(N.rumble.f.frequency, 120 + v * 25);
    set(N.leaves.g.gain, (s.inCrown || 0) * Math.min(1, v / 6) * 0.35);
    // the freewheel's ticks while coasting
    if (m === 'bike' && s.coasting && v > 0.6) {
      tick += dt * v * 9;
      if (tick > 1) { tick %= 1; burst({ dur: 0.012, freq: 6500, q: 4, gain: 0.05 }); }
    }
    // paving joints under a board
    if (m === 'board' && !s.air && v > 0.5 && !lawn) {
      joint += dt * v / 1.2;
      if (joint > 1) { joint %= 1; burst({ dur: 0.05, freq: 700, q: 1.5, gain: 0.12 }); thump(70, 0.12, 0.08); }
    }
    void ground;
  }
  function event(name, data = {}) {
    if (!ctx) return;
    if (name === 'bell') bell();
    else if (name === 'kick') { burst({ dur: 0.18, freq: 1600, q: 0.7, gain: 0.18, type: 'bandpass' }); }
    else if (name === 'pop') { burst({ dur: 0.06, freq: 2400, q: 2, gain: 0.35 }); thump(140, 0.35, 0.09); }
    else if (name === 'land') { burst({ dur: 0.1, freq: 900, q: 1, gain: 0.4 }); thump(80, 0.5, 0.16); }
    else if (name === 'bump') { thump(60, 0.45, 0.22); burst({ dur: 0.14, freq: 500, q: 0.8, gain: 0.25 }); }
    else if (name === 'touch') { burst({ dur: 0.4, freq: 900, q: 0.4, gain: 0.25 * (data.hit || 0.5) + 0.05, type: 'lowpass' }); }
    else if (name === 'summon') { for (let i = 0; i < 6; i++) burst({ dur: 0.12, freq: 2800 + i * 300, q: 1.2, gain: 0.05, at: i * 0.07 }); }
    else if (name === 'mount') { thump(110, 0.18, 0.12); }
    else if (name === 'sketch') { for (let i = 0; i < 10; i++) burst({ dur: 0.07, freq: 3200 + Math.random() * 1500, q: 1, gain: 0.05, at: i * 0.05 }); }
  }
  return {
    update, event, start,
    toggle() { muted = !muted; if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.85, ctx.currentTime, 0.1); return !muted; },
    get muted() { return muted; },
  };
}
