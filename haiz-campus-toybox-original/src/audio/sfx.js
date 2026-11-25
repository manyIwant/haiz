// HAIZ Campus Toybox — procedural Web Audio foley & music-box soundscape.
// Zero external audio dependencies; unlocks on first pointer/key gesture and supports mute.

export class ToyboxAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this._servoOsc = null;
    this._servoGain = null;
  }

  unlock() {
    if (this.muted) return;
    if (!this.ctx && typeof window !== 'undefined') {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) this.ctx = new AC();
    }
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  setMuted(m) {
    this.muted = !!m;
    if (this.muted) this.setServo(false);
  }

  /** Soft mechanical servo hum while the gantry is moving. */
  setServo(active) {
    if (!this.ctx || this.muted) active = false;
    if (active) {
      if (!this._servoOsc) {
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = 118;
        filter.type = 'lowpass';
        filter.frequency.value = 320;
        gain.gain.value = 0.0001;
        osc.connect(filter).connect(gain).connect(this.ctx.destination);
        osc.start();
        this._servoOsc = osc;
        this._servoGain = gain;
      }
      this._servoGain.gain.setTargetAtTime(0.032, this.ctx.currentTime, 0.04);
    } else if (this._servoGain && this.ctx) {
      this._servoGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.05);
    }
  }

  _tone({ freq = 440, endFreq, dur = 0.12, type = 'sine', vol = 0.12, delay = 0 } = {}) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  /** Tactile brass/wood button press. */
  pressButton() {
    this.unlock();
    this._tone({ freq: 210, endFreq: 95, dur: 0.09, type: 'triangle', vol: 0.18 });
    this._tone({ freq: 620, endFreq: 380, dur: 0.045, type: 'sine', vol: 0.08, delay: 0.015 });
  }

  /** Soft wooden click when starting a joystick move. */
  tick() {
    this.unlock();
    this._tone({ freq: 480, endFreq: 320, dur: 0.035, type: 'triangle', vol: 0.06 });
  }

  /** Mechanical claw closing / opening clack. */
  clawClack(close = true) {
    this.unlock();
    this._tone({ freq: close ? 340 : 260, endFreq: close ? 190 : 380, dur: 0.08, type: 'triangle', vol: 0.12 });
  }

  /** Soft felt thump when a toy settles. */
  plushThump() {
    this.unlock();
    this._tone({ freq: 145, endFreq: 68, dur: 0.11, type: 'sine', vol: 0.14 });
  }

  /** Gentle wooden two-note nudge when wrong toy or miss. */
  gentleMiss() {
    this.unlock();
    this._tone({ freq: 330, dur: 0.14, type: 'sine', vol: 0.09, delay: 0 });
    this._tone({ freq: 262, dur: 0.22, type: 'sine', vol: 0.09, delay: 0.12 });
  }

  /** Warm music-box / kalimba welcome arpeggio on success. */
  welcomeChime() {
    this.unlock();
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((f, i) => {
      this._tone({ freq: f, dur: 0.42, type: 'sine', vol: 0.1, delay: i * 0.085 });
      this._tone({ freq: f * 2, dur: 0.2, type: 'triangle', vol: 0.03, delay: i * 0.085 });
    });
  }

  dispose() {
    this.setServo(false);
    try { this._servoOsc?.stop(); } catch {}
    this._servoOsc = null;
    this._servoGain = null;
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}
