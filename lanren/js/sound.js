// Synthesised soundscape, off until the visitor turns it on.
// Leaves and wind follow the same gust signal that moves the canopy, so what
// you hear is what you see. Insects follow the season and the hour; nothing
// pretends to be a field recording.

function noiseBuffer(ctx, seconds = 4, pink = true) {
  const n = ctx.sampleRate * seconds;
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0;
  for (let i = 0; i < n; i++) {
    const w = Math.random() * 2 - 1;
    if (pink) {
      b0 = 0.99765 * b0 + w * 0.0990460;
      b1 = 0.96300 * b1 + w * 0.2965164;
      b2 = 0.57000 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.18;
    } else d[i] = w * 0.5;
  }
  return buf;
}

export class Soundscape {
  constructor() { this.ctx = null; this.on = false; this.lastRustle = 0; }

  async toggle() {
    if (!this.ctx) this._build();
    if (this.on) { await this.ctx.suspend(); this.on = false; }
    else { await this.ctx.resume(); this.on = true; }
    return this.on;
  }

  _build() {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(ctx.destination);
    const pink = noiseBuffer(ctx, 6, true);
    const white = noiseBuffer(ctx, 3, false);
    this.white = white;
    // low wind body
    const w = ctx.createBufferSource(); w.buffer = pink; w.loop = true;
    const wl = ctx.createBiquadFilter(); wl.type = 'lowpass'; wl.frequency.value = 380;
    this.windGain = ctx.createGain(); this.windGain.gain.value = 0;
    w.connect(wl).connect(this.windGain).connect(this.master); w.start();
    // the canopy: bright filtered noise, shaped by gusts
    const l = ctx.createBufferSource(); l.buffer = white; l.loop = true;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1700;
    const bp = ctx.createBiquadFilter(); bp.type = 'peaking'; bp.frequency.value = 4200; bp.gain.value = 5;
    this.leafGain = ctx.createGain(); this.leafGain.gain.value = 0;
    l.connect(hp).connect(bp).connect(this.leafGain).connect(this.master); l.start();
    // rain (年轮): band-limited noise, silent until a rainy day is chosen
    const rn = ctx.createBufferSource(); rn.buffer = white; rn.loop = true;
    const rhp = ctx.createBiquadFilter(); rhp.type = 'highpass'; rhp.frequency.value = 1100;
    const rlp = ctx.createBiquadFilter(); rlp.type = 'lowpass'; rlp.frequency.value = 7200;
    this.rainGain = ctx.createGain(); this.rainGain.gain.value = 0;
    rn.connect(rhp).connect(rlp).connect(this.rainGain).connect(this.master); rn.start();
    // insects: cicada-like buzz by day in the warm months, crickets at night
    const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 4700;
    const ibp = ctx.createBiquadFilter(); ibp.type = 'bandpass'; ibp.frequency.value = 4900; ibp.Q.value = 6;
    const am = ctx.createGain(); am.gain.value = 0;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 88;
    const lfoAmt = ctx.createGain(); lfoAmt.gain.value = 0.5;
    lfo.connect(lfoAmt).connect(am.gain);
    this.insectGain = ctx.createGain(); this.insectGain.gain.value = 0;
    this.insectLfo = lfo;
    osc.connect(ibp).connect(am).connect(this.insectGain).connect(this.master);
    osc.start(); lfo.start();
    this.insectOsc = osc;
  }

  update(wind, season, parts, sun) {
    if (!this.on || !this.ctx) return;
    const t = this.ctx.currentTime;
    const leaves = 1 - (season?.fallen || 0) * 0.85;
    this.windGain.gain.setTargetAtTime(0.05 + wind * 0.18, t, 0.4);
    this.leafGain.gain.setTargetAtTime((0.004 + wind * 0.03) * leaves, t, 0.25);
    const alt = sun ? sun.altitude * 180 / Math.PI : 30;
    const doy = parts?.dayOfYear || 200;
    const warm = doy > 105 && doy < 300;
    const day = alt > 8;
    let insect = 0;
    if (warm && day) { insect = 0.012 * Math.min(1, (alt - 8) / 20); this.insectOsc.frequency.setTargetAtTime(4700, t, 1); this.insectLfo.frequency.setTargetAtTime(88, t, 1); }
    else if (alt < -4) { insect = 0.006; this.insectOsc.frequency.setTargetAtTime(4300, t, 1); this.insectLfo.frequency.setTargetAtTime(3.2, t, 1); }
    this.insectGain.gain.setTargetAtTime(insect, t, 1.2);
  }

  /** 0 dry … 1 a downpour */
  setRain(k) {
    if (!this.ctx || !this.rainGain) return;
    this.rainGain.gain.setTargetAtTime(this.on ? 0.11 * Math.max(0, Math.min(1, k)) : 0, this.ctx.currentTime, 0.5);
  }

  _burst(gain, hp, dur, freq = 4000) {
    if (!this.on || !this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const s = ctx.createBufferSource(); s.buffer = this.white;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.7;
    const h = ctx.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = hp;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + dur * 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(h).connect(f).connect(g).connect(this.master);
    s.start(t, Math.random() * 2, dur + 0.05);
  }
  rustle(k = 1) {
    const now = performance.now();
    if (now - this.lastRustle < 140) return;
    this.lastRustle = now;
    this._burst(0.05 * k, 1500, 0.35 + 0.2 * k, 3600 + Math.random() * 1200);
  }
  land() { this._burst(0.012, 900, 0.07, 2500); }
  catch() {
    if (!this.on || !this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    for (const [f, a] of [[660, 0.05], [990, 0.025], [1320, 0.012]]) {
      const o = ctx.createOscillator(); o.frequency.value = f; o.type = 'sine';
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      o.connect(g).connect(this.master); o.start(t); o.stop(t + 1.7);
    }
  }
}
