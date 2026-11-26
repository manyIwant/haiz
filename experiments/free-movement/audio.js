// HAIZ · 自由移动 — Procedural Web Audio Soundscape
//
// Follows Petalwake's acoustic design principle: broadband filtered noise (never whining resonant
// oscillators) for wind, surface rolling, leaf rustle, and water spray — paired with physical
// one-shots (harmonic brass bike bell, freewheel ratchet clicks, wooden skateboard Ollie/Kickflip
// pop-clack, and a gentle pentatonic bamboo variometer wind-chime for the Terminalia Glider!).
export function createAudio() {
  let ctx = null, master = null, noiseBuf = null;
  let windF, windG, hissF, hissG, rollF, rollG, skimF, skimG, panNode;
  let muted = false;
  let tickAcc = 0, chimeAcc = 0, chimeIdx = 0;

  function boot() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.72;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 3;
    master.connect(comp).connect(ctx.destination);

    // 4-second stereo pink noise buffer (Paul Kellet economy filter)
    const len = ctx.sampleRate * 4;
    noiseBuf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = noiseBuf.getChannelData(c);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + w * 0.0990460;
        b1 = 0.96300 * b1 + w * 0.2965164;
        b2 = 0.57000 * b2 + w * 1.0526913;
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.22;
      }
    }

    const src = (rate = 1) => {
      const s = ctx.createBufferSource();
      s.buffer = noiseBuf; s.loop = true; s.playbackRate.value = rate;
      s.start(0, Math.random() * 3);
      return s;
    };
    const flt = (type, f, q) => {
      const b = ctx.createBiquadFilter();
      b.type = type; b.frequency.value = f; b.Q.value = q;
      return b;
    };
    const gn = (v = 0) => { const g = ctx.createGain(); g.gain.value = v; return g; };

    panNode = ctx.createStereoPanner ? ctx.createStereoPanner() : gn(1);
    panNode.connect(master);

    // Broadband airflow body + upper air hiss
    windF = flt('bandpass', 420, 0.4); windG = gn(0);
    src(1.0).connect(windF).connect(windG).connect(panNode);

    hissF = flt('highpass', 2400, 0.5); hissG = gn(0);
    src(1.27).connect(hissF).connect(hissG).connect(panNode);

    // Ground rolling / urethane rumble
    rollF = flt('bandpass', 280, 0.7); rollG = gn(0);
    src(0.85).connect(rollF).connect(rollG).connect(master);

    // Surface skim (water spray / foliage crown rustle)
    skimF = flt('bandpass', 3200, 0.75); skimG = gn(0);
    src(1.15).connect(skimF).connect(skimG).connect(panNode);
  }

  const unlock = () => { boot(); };
  addEventListener('pointerdown', unlock, { once: true, passive: true });
  addEventListener('keydown', unlock, { once: true, passive: true });

  function tone(freq, dur, amp, type = 'sine', delay = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(amp, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0004, t + dur);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + dur + 0.04);
  }

  function noiseHit(f, q, dur, amp, delay = 0) {
    if (!ctx || muted || !noiseBuf) return;
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; s.loop = true;
    fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = q;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(amp, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0004, t + dur);
    s.connect(fl).connect(g).connect(master);
    s.start(t, Math.random() * 3); s.stop(t + dur + 0.04);
  }

  // Real bicycle brass bell: two quick strikes with bright inharmonic partials
  function playBell() {
    for (const d of [0, 0.14]) {
      tone(1980, 0.85, 0.13, 'sine', d);
      tone(4240, 0.45, 0.045, 'sine', d);
      tone(6720, 0.22, 0.018, 'sine', d);
    }
  }

  // Glider bamboo variometer wind-chime (pentatonic ascent inside a warm thermal!)
  const SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66];
  function playThermalChime(lift) {
    const f = SCALE[chimeIdx % SCALE.length];
    chimeIdx++;
    const amp = Math.min(0.085, 0.03 + lift * 0.016);
    tone(f, 1.35, amp, 'sine', 0);
    tone(f * 2.75, 0.5, amp * 0.22, 'sine', 0);
  }

  function event(name, data = {}) {
    if (!ctx || muted) return;
    if (name === 'bell') playBell();
    else if (name === 'kick') noiseHit(540, 0.7, 0.12, 0.22);
    else if (name === 'pop') { noiseHit(1500, 1.2, 0.07, 0.34); noiseHit(420, 0.9, 0.11, 0.25, 0.02); }
    else if (name === 'trick') { noiseHit(1900, 1.0, 0.09, 0.30); tone(660, 0.25, 0.04, 'triangle', 0.04); }
    else if (name === 'land') { noiseHit(260, 0.7, 0.14, Math.min(0.45, 0.18 + (data.v || 2) * 0.06)); }
    else if (name === 'bump') { noiseHit(180, 0.8, 0.16, 0.34); }
    else if (name === 'touch') { noiseHit(320, 0.5, 0.24, 0.28); }
    else if (name === 'sketch') { tone(587.33, 1.2, 0.09, 'sine', 0); tone(880, 1.5, 0.08, 'sine', 0.09); tone(1174.66, 2.0, 0.07, 'sine', 0.18); }
    else if (name === 'summon' || name === 'perch') { noiseHit(900, 0.6, 0.38, 0.16); }
  }

  function update(dt, s) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const speed = s.speed || 0;
    const v = Math.min(1, speed / 22);

    // Wind body + hiss + stereo bank pan
    windF.frequency.setTargetAtTime(340 + 360 * v, t, 0.25);
    windG.gain.setTargetAtTime((s.mode === 'broom' || s.mode === 'glider' ? 0.04 : 0.01) + 0.28 * Math.pow(v, 1.35) + (s.boost || 0) * 0.08, t, 0.1);
    hissG.gain.setTargetAtTime(0.11 * Math.pow(v, 1.8) + (s.boost || 0) * 0.06, t, 0.1);
    if (panNode.pan) panNode.pan.setTargetAtTime(Math.max(-0.28, Math.min(0.28, (s.roll || 0) * 0.3)), t, 0.25);

    // Surface rolling rumble (bike tires / skateboard urethane wheels)
    let rAmp = 0, rFreq = 260;
    if ((s.mode === 'bike' || s.mode === 'board') && !s.air && speed > 0.3) {
      const k = Math.min(1, speed / 7);
      if (s.mode === 'board') {
        rFreq = s.surface === 'lawn' ? 190 : 420 + k * 240;
        rAmp = (s.surface === 'lawn' ? 0.08 : 0.16) * k;
      } else {
        rFreq = s.surface === 'lawn' ? 320 : 210 + k * 90;
        rAmp = (s.surface === 'lawn' ? 0.12 : 0.055) * k;
      }
    }
    rollF.frequency.setTargetAtTime(rFreq, t, 0.12);
    rollG.gain.setTargetAtTime(rAmp, t, 0.08);

    // Freewheel ratchet ticks when coasting on the bicycle!
    if (s.mode === 'bike' && s.coasting && speed > 1.2) {
      tickAcc += dt * (8 + speed * 2.2);
      if (tickAcc >= 1) {
        tickAcc -= 1;
        noiseHit(3600, 3.0, 0.016, 0.045);
      }
    } else tickAcc = 0;

    // Skim sound (砚池 water spray hiss / foliage rustle)
    let skAmp = 0, skFreq = 3200;
    if (s.inCrown > 0.08 && speed > 1) { skFreq = 2400; skAmp = Math.min(0.26, s.inCrown * speed * 0.03); }
    else if (s.overWater && (s.mode === 'broom' || s.mode === 'glider') && s.agl < 3.5 && speed > 2) {
      skFreq = 4800; skAmp = Math.min(0.32, (1 - s.agl / 3.5) * speed * 0.025);
    }
    skimF.frequency.setTargetAtTime(skFreq, t, 0.14);
    skimG.gain.setTargetAtTime(skAmp, t, 0.08);

    // Glider bamboo audio variometer inside thermal updrafts!
    if (s.mode === 'glider' && (s.thermalLift || 0) > 0.65) {
      chimeAcc += dt * (0.85 + s.thermalLift * 0.55);
      if (chimeAcc >= 1) {
        chimeAcc -= 1;
        playThermalChime(s.thermalLift);
      }
    } else chimeAcc = Math.min(chimeAcc, 0.6);
  }

  return {
    boot, event, update,
    toggle() {
      muted = !muted;
      if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.72, ctx.currentTime, 0.12);
      return !muted;
    },
    get on() { return !muted; },
  };
}
