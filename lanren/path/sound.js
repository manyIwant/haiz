// Sound, synthesised (no recordings): three layers, each tied to something you can see.
//   bed      the city beyond the walls at 7 a.m.: a low, filtered hum, quieter inside the campus
//   leaves   wind in broad leaves, louder under crowns, rising and falling with the same gusts that
//            move the tree (foliage UNIFORMS.uGust is not read here; the gust is its own slow LFO)
//   life     an occasional bird in the crown of the century tree, panned to where the tree is; and
//            footsteps on paving when you walk (soil on the bed)
// Off until the visitor turns it on (browsers require a gesture anyway).
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

export function createSound() {
  let ctx = null, on = false, nodes = null, nextBird = 2, t = 0;

  function noiseBuffer(c, sec = 3, colour = 'pink') {
    const n = c.sampleRate * sec, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (colour === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else { b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.11; }
    }
    return b;
  }
  function build() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    const loop = (buf, ...chain) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; let n = s; for (const c of chain) { n.connect(c); n = c; } s.start(); return n; };
    const brown = noiseBuffer(ctx, 4, 'brown'), pink = noiseBuffer(ctx, 4, 'pink');
    // bed
    const bedF = ctx.createBiquadFilter(); bedF.type = 'lowpass'; bedF.frequency.value = 260;
    const bedG = ctx.createGain(); bedG.gain.value = 0.16;
    loop(brown, bedF, bedG).connect(master);
    // leaves
    const lf = ctx.createBiquadFilter(); lf.type = 'bandpass'; lf.frequency.value = 3200; lf.Q.value = 0.5;
    const lh = ctx.createBiquadFilter(); lh.type = 'highshelf'; lh.frequency.value = 6000; lh.gain.value = -6;
    const leafG = ctx.createGain(); leafG.gain.value = 0;
    const leafP = ctx.createStereoPanner();
    loop(pink, lf, lh, leafG, leafP).connect(master);
    nodes = { master, bedG, leafG, leafP, lf };
  }
  function bird(pan, gain) {
    // a magpie-robin-like phrase: a few sliding whistles (an impression, not a species recording)
    const now = ctx.currentTime;
    const p = ctx.createStereoPanner(); p.pan.value = pan; p.connect(nodes.master);
    const notes = 3 + Math.floor(Math.random() * 4);
    let at = now;
    for (let i = 0; i < notes; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      const f0 = 2200 + Math.random() * 1800, f1 = f0 * (0.75 + Math.random() * 0.6), d = 0.07 + Math.random() * 0.16;
      o.frequency.setValueAtTime(f0, at); o.frequency.exponentialRampToValueAtTime(f1, at + d);
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(gain * 0.09, at + 0.015); g.gain.exponentialRampToValueAtTime(0.0005, at + d);
      o.connect(g).connect(p); o.start(at); o.stop(at + d + 0.02);
      at += d + 0.03 + Math.random() * 0.12;
    }
  }
  function step(soft) {
    if (!on || !ctx) return;
    const now = ctx.currentTime, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = nodes.stepBuf || (nodes.stepBuf = noiseBuffer(ctx, 0.2, 'pink'));
    f.type = 'bandpass'; f.frequency.value = soft ? 500 : 1400 + Math.random() * 400; f.Q.value = 0.9;
    g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(soft ? 0.18 : 0.32, now + 0.006); g.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    s.connect(f).connect(g).connect(nodes.master); s.start(now); s.stop(now + 0.15);
  }

  return {
    enable(v) {
      on = v;
      if (on && !ctx) build();
      if (!ctx) return;
      if (on) ctx.resume();
      nodes.master.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.4);
    },
    step,
    update(dt, camera, world, S, walker) {
      t += dt;
      if (!on || !ctx) return;
      if (!walker._soundHooked) { walker._soundHooked = true; walker.onStep((v, p) => step(world.bed.inside(p.x, p.z))); }
      const p = camera.position;
      // nearest crown: the century tree (r 12) or the grove
      let near = Math.max(0, 1 - Math.hypot(p.x, p.z) / 26);
      for (const tr of world.grove.list) { const d = Math.hypot(p.x - tr.x, p.z - tr.z); if (d < 14) near = Math.max(near, (1 - d / 14) * 0.6); }
      const gust = 0.55 + 0.45 * Math.sin(t * 0.21) * Math.sin(t * 0.077 + 1.0);
      nodes.leafG.gain.setTargetAtTime(0.03 + near * 0.32 * gust, ctx.currentTime, 0.3);
      nodes.lf.frequency.setTargetAtTime(2600 + gust * 1400, ctx.currentTime, 0.5);
      // pan towards the tree
      const fwd = camera.getWorldDirection(camera.position.clone()).setY(0).normalize();
      const right = { x: -fwd.z, z: fwd.x };
      const to = { x: -p.x, z: -p.z }, L = Math.hypot(to.x, to.z) || 1;
      const pan = clamp((to.x * right.x + to.z * right.z) / L, -0.8, 0.8);
      nodes.leafP.pan.setTargetAtTime(pan * near, ctx.currentTime, 0.3);
      // inside the walls the street is quieter
      nodes.bedG.gain.setTargetAtTime(p.z < -84 ? 0.22 : 0.12, ctx.currentTime, 1.2);
      nextBird -= dt;
      if (nextBird < 0) { nextBird = 4 + Math.random() * 9; const d = Math.hypot(p.x, p.z); if (d < 60) bird(pan, clamp(1 - d / 60, 0.15, 1)); }
    },
  };
}
