/**
 * HAIZ Toybox V2 — Procedural Web Audio Mechanical & Toy Foley Engine
 */

export class SoundEngine {
  constructor(enabled = true) {
    this._enabled = Boolean(enabled);
    this._ctx = null;
    this._servoOsc = null;
    this._servoGain = null;
    this._destroyed = false;
  }

  get enabled() { return this._enabled; }

  setEnabled(flag) {
    this._enabled = Boolean(flag);
    if (!this._enabled) this.stopServo();
  }

  unlock() {
    if (this._destroyed || !this._enabled || typeof window === 'undefined') return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!this._ctx) {
      try { this._ctx = new AC(); } catch (_e) { return; }
    }
    if (this._ctx.state === 'suspended') this._ctx.resume().catch(() => {});
  }

  _ready() {
    if (this._destroyed || !this._enabled || !this._ctx) return false;
    if (this._ctx.state === 'suspended') this._ctx.resume().catch(() => {});
    return this._ctx.state === 'running';
  }

  playWake() {
    if (!this._ready()) return;
    const t = this._ctx.currentTime;
    this._tone(440, 523.25, t, 0.14, 0.04, 'sine');
    this._tone(659.25, 659.25, t + 0.08, 0.16, 0.035, 'triangle');
  }

  playButtonClick() {
    if (!this._ready()) return;
    const t = this._ctx.currentTime;
    this._tone(860, 260, t, 0.045, 0.09, 'triangle');
    this._tone(165, 105, t + 0.01, 0.05, 0.075, 'sine');
  }

  updateServo(speedRatio) {
    if (!this._ready() || speedRatio < 0.06) {
      this.stopServo();
      return;
    }
    const ctx = this._ctx;
    const t = ctx.currentTime;
    if (!this._servoOsc) {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      filter.type = 'lowpass';
      filter.frequency.value = 240;
      gain.gain.setValueAtTime(0.0001, t);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      this._servoOsc = osc;
      this._servoGain = gain;
    }
    const c = Math.min(1, Math.max(0, speedRatio));
    this._servoOsc.frequency.setTargetAtTime(100 + c * 46, t, 0.04);
    this._servoGain.gain.setTargetAtTime(0.010 + c * 0.014, t, 0.05);
  }

  stopServo() {
    if (!this._servoOsc || !this._servoGain || !this._ctx) return;
    const t = this._ctx.currentTime;
    try {
      this._servoGain.gain.setTargetAtTime(0.0001, t, 0.03);
      const osc = this._servoOsc;
      setTimeout(() => { try { osc.stop(); osc.disconnect(); } catch (_e) {} }, 90);
    } catch (_e) {}
    this._servoOsc = null;
    this._servoGain = null;
  }

  playDescent() {
    if (!this._ready()) return;
    const t = this._ctx.currentTime;
    this._tone(300, 185, t, 0.34, 0.042, 'triangle');
  }

  playGrab(caught) {
    if (!this._ready()) return;
    const t = this._ctx.currentTime;
    if (caught) {
      this._tone(195, 310, t, 0.11, 0.08, 'sine');
      this._tone(392, 523.25, t + 0.07, 0.14, 0.055, 'triangle');
    } else {
      this._tone(230, 135, t, 0.12, 0.05, 'triangle');
    }
  }

  playDrop() {
    if (!this._ready()) return;
    const t = this._ctx.currentTime;
    this._tone(500, 250, t, 0.14, 0.055, 'sine');
    this._tone(160, 110, t + 0.15, 0.09, 0.07, 'sine');
  }

  playPopUpCelebration() {
    if (!this._ready()) return;
    const t = this._ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      this._tone(f, f, t + i * 0.07, 0.30, 0.06, 'sine');
    });
  }

  playSoftRetry() {
    if (!this._ready()) return;
    const t = this._ctx.currentTime;
    this._tone(320, 255, t, 0.14, 0.052, 'sine');
    this._tone(255, 215, t + 0.11, 0.15, 0.042, 'sine');
  }

  _tone(f0, f1, start, dur, amp, type) {
    const ctx = this._ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, start);
    if (f0 !== f1) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), start + dur);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(amp, start + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  destroy() {
    this._destroyed = true;
    this.stopServo();
    if (this._ctx) {
      try { this._ctx.close(); } catch (_e) {}
      this._ctx = null;
    }
  }
}
