// HAIZ Campus Toybox — character behaviour runtime.
//
// Every toy is a small hierarchy of named pivots (its "rig"). A Behaviour resets the rig to its
// rest pose every frame and then layers procedural motion on top: breathing, blinking, looking,
// personality idles, and one-shot reactions (touched by the claw, lifted, landing, celebrating).
//
// The same code drives (1) the claw machine, (2) the Toybox gallery and (3) the GLB exporter,
// which samples behaviours into standard glTF animation clips. Nothing here depends on the DOM.
import * as THREE from 'three';
import { rng } from './textures.js';

const _e = new THREE.Euler();
const _q = new THREE.Quaternion();

export const CLIP_LIBRARY = {
  idle: { loop: true, duration: 8, label: '闲置 Idle' },
  look: { loop: true, duration: 6, label: '好奇张望 Look around' },
  touch: { loop: false, duration: 1.1, label: '被爪子碰到 Touched' },
  lifted: { loop: true, duration: 3, label: '被提起 Lifted' },
  land: { loop: false, duration: 1.2, label: '落地缓冲 Land' },
  celebrate: { loop: false, duration: 2.4, label: '欢迎仪式 Welcome' },
  signature: { loop: false, duration: 3, label: '招牌动作 Signature' },
};

/** Critically damped spring for secondary motion (follow-through, overlap). */
export class Spring {
  constructor(k = 120, d = 14, v0 = 0) { this.k = k; this.d = d; this.x = v0; this.v = 0; }
  step(target, dt) {
    const a = this.k * (target - this.x) - this.d * this.v;
    this.v += a * dt; this.x += this.v * dt;
    return this.x;
  }
  reset(v = 0) { this.x = v; this.v = 0; }
}

export const ease = {
  outBack: (t, s = 1.7) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  out: (t) => 1 - Math.pow(1 - t, 3),
  bell: (t) => Math.sin(Math.PI * Math.min(1, Math.max(0, t))),
  // damped oscillation used for landings & wobbles: starts at 1, settles to 0
  wobble: (t, freq = 3, decay = 4) => Math.exp(-decay * t) * Math.cos(t * freq * Math.PI * 2),
};
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const win = (t, a, b) => clamp01((t - a) / (b - a));

export class ToyBehavior {
  /**
   * @param {object} rig   { root, nodes: {key: Object3D} }
   * @param {object} opts  { seed }
   */
  constructor(rig, opts = {}) {
    this.rig = rig;
    this.nodes = rig.nodes;
    this.rest = {};
    for (const [k, o] of Object.entries(this.nodes)) {
      this.rest[k] = { p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() };
    }
    this.seed = opts.seed ?? 1;
    this.reducedMotion = !!opts.reducedMotion;
    this.reset();
  }

  reset() {
    this.rand = rng(this.seed);
    this.time = 0;
    this.clip = 'idle';
    this.clipTime = 0;
    this.nextBlink = 1.2 + this.rand() * 2;
    this.blinkT = -1;
    this.look = { yaw: 0, pitch: 0, active: false };
    this.lookYaw = new Spring(30, 10); this.lookPitch = new Spring(30, 10);
    this.hang = { active: false, swingX: 0, swingZ: 0, accel: 0 };
    this.springs = {};
    this.restore();
  }

  /** Start a clip ('idle', 'look', 'touch', 'lifted', 'land', 'celebrate', 'signature'). */
  play(name) {
    this.clip = name;
    this.clipTime = 0;
    this.onClip?.(name);
  }

  /** Host (machine/gallery) sets where the toy should look, in the toy root's local space. */
  setLookLocal(v) {
    if (!v) { this.look.active = false; return; }
    this.look.active = true;
    this.look.yaw = Math.atan2(v.x, v.z);
    this.look.pitch = Math.atan2(v.y - (this.rig.eyeHeight || 0.08), Math.hypot(v.x, v.z));
  }

  spring(key, k, d) {
    return this.springs[key] || (this.springs[key] = new Spring(k, d));
  }

  restore() {
    for (const [k, o] of Object.entries(this.nodes)) {
      const r = this.rest[k];
      o.position.copy(r.p); o.quaternion.copy(r.q); o.scale.copy(r.s);
    }
  }

  // --- pose helpers (all offsets are relative to rest pose, and accumulate) ---
  rot(key, x = 0, y = 0, z = 0) {
    const o = this.nodes[key]; if (!o) return;
    _q.setFromEuler(_e.set(x, y, z, 'XYZ'));
    o.quaternion.multiply(_q);
  }
  move(key, x = 0, y = 0, z = 0) {
    const o = this.nodes[key]; if (!o) return;
    o.position.x += x; o.position.y += y; o.position.z += z;
  }
  scl(key, x = 1, y = 1, z = 1) {
    const o = this.nodes[key]; if (!o) return;
    o.scale.x *= x; o.scale.y *= y; o.scale.z *= z;
  }
  /** Volume-preserving squash: y scale s, xz compensate. */
  squash(key, s) { this.scl(key, 1 / Math.sqrt(s), s, 1 / Math.sqrt(s)); }

  /** 0 = open, 1 = closed. Natural blink: fast close, slower open; occasional double blink. */
  blinkAmount(dt) {
    if (this.blinkT < 0) {
      this.nextBlink -= dt;
      if (this.nextBlink <= 0) { this.blinkT = 0; this.double = this.rand() < 0.2; }
      return 0;
    }
    this.blinkT += dt;
    const t = this.blinkT;
    const dur = this.double ? 0.42 : 0.2;
    let a;
    if (this.double) a = t < 0.2 ? ease.bell(t / 0.2) : ease.bell((t - 0.22) / 0.2);
    else a = ease.bell(t / 0.2);
    if (t > dur) { this.blinkT = -1; this.nextBlink = (this.blinkInterval || 2.5) + this.rand() * 3.5; }
    return Math.max(0, a);
  }

  update(dt) {
    dt = Math.min(dt, 1 / 20);
    this.time += dt;
    this.clipTime += dt;
    const def = CLIP_LIBRARY[this.clip];
    if (def && !def.loop && this.clipTime > (this.clipDurations?.[this.clip] ?? def.duration)) {
      const next = this.clip === 'land' || this.clip === 'touch' ? 'idle' : (this.afterClip?.(this.clip) || 'idle');
      if (this.clip !== 'celebrate' || !this.holdCelebrate) this.play(next);
    }
    const ly = this.look.active ? this.look.yaw : 0;
    const lp = this.look.active ? this.look.pitch : 0;
    this.lookYaw.step(Math.max(-0.7, Math.min(0.7, ly)), dt);
    this.lookPitch.step(Math.max(-0.35, Math.min(0.5, lp)), dt);
    this.restore();
    const ctx = {
      t: this.time, dt, clip: this.clip, ct: this.clipTime,
      blink: this.blinkAmount(dt),
      lookYaw: this.lookYaw.x, lookPitch: this.lookPitch.x,
      hang: this.hang, rm: this.reducedMotion ? 0.35 : 1,
    };
    this.pose(ctx);
  }

  /** Override per character. */
  pose() {}
}
