/**
 * HAIZ · NIANLUN · 一卷 V4 — Optional Tactile Foley & Haptic Detents
 *
 * Adapted cleanly from HAIZ NIANLUN 004 `sound.js` (zero audio files, pure Web Audio synthesis).
 * Quiet by default; opt-in toggle in Settings; never throws in headless/restricted contexts.
 */

let audioCtx = null;
let masterGain = null;
let noiseBuf = null;
let lastTickMs = 0;

function ensureAudio(enabled) {
  if (!enabled) return null;
  if (audioCtx) {
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    return audioCtx;
  }
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  try {
    audioCtx = new AC();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.28;
    masterGain.connect(audioCtx.destination);
    const len = Math.floor(audioCtx.sampleRate * 0.4);
    noiseBuf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const ch = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    return audioCtx;
  } catch {
    return null;
  }
}

export const foley = {
  vibrate(ms = 8) {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(ms);
      }
    } catch {
      // Unsupported platform
    }
  },

  /** Crisp wooden detent tick when crossing 1/7 revolution on the annual-ring dial */
  dialTick(enabled, strong = false) {
    this.vibrate(strong ? 12 : 7);
    const now = performance.now();
    if (!enabled || now - lastTickMs < 24) return;
    lastTickMs = now;
    const ctx = ensureAudio(enabled);
    if (!ctx || !noiseBuf) return;
    try {
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = strong ? 1450 : 2250 + Math.random() * 350;
      bp.Q.value = 5.5;
      const g = ctx.createGain();
      g.gain.setValueAtTime(strong ? 0.08 : 0.045, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (strong ? 0.04 : 0.02));
      src.connect(bp).connect(g).connect(masterGain);
      src.start(t, Math.random() * 0.2, 0.05);
    } catch {
      // Ignore audio errors
    }
  },

  /** Soft paper roll snap when days curl into a cylinder or unroll */
  rollSnap(enabled) {
    this.vibrate(10);
    const ctx = ensureAudio(enabled);
    if (!ctx) return;
    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(190, t);
      osc.frequency.exponentialRampToValueAtTime(88, t + 0.11);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.07, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      osc.connect(g).connect(masterGain);
      osc.start(t);
      osc.stop(t + 0.13);
    } catch {
      // Ignore
    }
  },
};
