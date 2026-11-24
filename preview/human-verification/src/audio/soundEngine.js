/**
 * HAIZ Human Verification — Procedural Web Audio Foley Synthesizer
 * Zero external audio downloads required; strictly unlocks on first user gesture.
 */

export class SoundEngine {
  constructor(enabled = true) {
    this._enabled = Boolean(enabled);
    this._ctx = null;
    this._servoOsc = null;
    this._servoGain = null;
    this._destroyed = false;
  }

  get enabled() {
    return this._enabled;
  }

  setEnabled(flag) {
    this._enabled = Boolean(flag);
    if (!this._enabled) {
      this.stopServo();
    }
  }

  unlock() {
    if (this._destroyed || !this._enabled) return;
    if (typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    if (!this._ctx) {
      try {
        this._ctx = new AudioCtx();
      } catch (_e) {
        return;
      }
    }
    if (this._ctx.state === 'suspended') {
      this._ctx.resume().catch(() => {});
    }
  }

  _ready() {
    if (this._destroyed || !this._enabled || !this._ctx) return false;
    if (this._ctx.state === 'suspended') {
      this._ctx.resume().catch(() => {});
    }
    return this._ctx.state === 'running';
  }

  /** Subtle mechanical wake chime */
  playWake() {
    if (!this._ready()) return;
    const t = this._ctx.currentTime;
    this._tone(440, 523.25, t, 0.14, 0.04, 'sine');
    this._tone(659.25, 659.25, t + 0.09, 0.16, 0.035, 'triangle');
  }

  /** Tactile micro-switch click for physical button press */
  playButtonClick() {
    if (!this._ready()) return;
    const t = this._ctx.currentTime;
    this._tone(920, 280, t, 0.045, 0.09, 'triangle');
    this._tone(180, 110, t + 0.01, 0.05, 0.07, 'sine');
  }

  /** Continuous subtle servo motor hum proportional to gantry speed */
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
      filter.frequency.value = 260;
      gain.gain.setValueAtTime(0.0001, t);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      this._servoOsc = osc;
      this._servoGain = gain;
    }
    const clamped = Math.min(1, Math.max(0, speedRatio));
    this._servoOsc.frequency.setTargetAtTime(105 + clamped * 48, t, 0.04);
    this._servoGain.gain.setTargetAtTime(0.012 + clamped * 0.015, t, 0.05);
  }

  stopServo() {
    if (!this._servoOsc || !this._servoGain || !this._ctx) return;
    const t = this._ctx.currentTime;
    try {
      this._servoGain.gain.setTargetAtTime(0.0001, t, 0.03);
      const osc = this._servoOsc;
      setTimeout(() => {
        try { osc.stop(); osc.disconnect(); } catch (_e) {}
      }, 90);
    } catch (_e) {}
    this._servoOsc = null;
    this._servoGain = null;
  }

  /** Spring lowering whirr */
  playDescent() {
    if (!this._ready()) return;
    const t = this._ctx.currentTime;
    this._tone(310, 195, t, 0.34, 0.045, 'triangle');
  }

  /** Soft cushioned plushie grasp thump */
  playGrab(caught) {
    if (!this._ready()) return;
    const t = this._ctx.currentTime;
    if (caught) {
      this._tone(190, 290, t, 0.11, 0.08, 'sine');
      this._tone(392, 493.88, t + 0.07, 0.14, 0.055, 'triangle');
    } else {
      this._tone(240, 140, t, 0.12, 0.05, 'triangle');
    }
  }

  /** Plushie released into prize chute */
  playDrop() {
    if (!this._ready()) return;
    const t = this._ctx.currentTime;
    this._tone(520, 260, t, 0.14, 0.055, 'sine');
    this._tone(160, 115, t + 0.16, 0.09, 0.07, 'sine');
  }

  /** Warm restrained marimba triad on verified success */
  playSuccess() {
    if (!this._ready()) return;
    const t = this._ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      this._tone(freq, freq, t + i * 0.075, 0.32, 0.065, 'sine');
    });
  }

  /** Gentle wooden tap on wrong catch (non-punitive) */
  playSoftRetry() {
    if (!this._ready()) return;
    const t = this._ctx.currentTime;
    this._tone(330, 262, t, 0.14, 0.055, 'sine');
    this._tone(262, 220, t + 0.11, 0.16, 0.045, 'sine');
  }

  _tone(startFreq, endFreq, startTime, duration, peakGain, type = 'sine') {
    const ctx = this._ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(startFreq, startTime);
    if (startFreq !== endFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), startTime + duration);
    }
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  destroy() {
    this._destroyed = true;
    this.stopServo();
    if (this._ctx) {
      try {
        this._ctx.close();
      } catch (_e) {}
      this._ctx = null;
    }
  }
}
