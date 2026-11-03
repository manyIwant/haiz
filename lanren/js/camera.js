// A camera for standing under a tree.
// The homepage drives it along a rail of frames (scroll = walking around and
// up the tree); dragging adds a free look on top that eases back when the
// walk resumes. No cuts: every move is continuous.
import * as THREE from 'three';
import { frameOf } from './chapters.js';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const damp = (cur, target, lambda, dt) => target + (cur - target) * Math.exp(-lambda * dt);
const KEYS = ['ex', 'ey', 'ez', 'lx', 'ly', 'lz'];

export class DwellCamera {
  constructor(camera, dom) {
    this.camera = camera;
    this.dom = dom;
    this.s = { ex: 4.6, ey: 1.25, ez: -9.4, lx: 3.5, ly: 3.6, lz: 0 };
    this.rail = null;             // () => frame
    this.off = { az: 0, pitch: 0 };
    this.offTarget = { az: 0, pitch: 0 };
    this.lastInput = performance.now();
    this.dragging = false;
    this.enabled = true;
    this.onTap = null;
    this.onHover = null;
    this.onScroll = null;         // (deltaPixels) for the rail
    this.push = null;             // transition push towards a point
    this._bind();
  }

  idleSeconds() { return (performance.now() - this.lastInput) / 1000; }
  touch() { this.lastInput = performance.now(); }
  releaseLook() { this.offTarget.az = 0; this.offTarget.pitch = 0; }
  snap() { if (this.rail) Object.assign(this.s, this.rail()); }

  _bind() {
    const el = this.dom;
    const pts = new Map();
    let moved = 0, downT = 0, lastY = 0, swipe = false, startX = 0, startY = 0;
    el.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      el.setPointerCapture?.(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved = 0; downT = performance.now(); lastY = e.clientY; startX = e.clientX; startY = e.clientY; swipe = false;
      this.dragging = true;
      this.touch();
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.enabled) return;
      const p = pts.get(e.pointerId);
      if (!p) { this.onHover?.(e); return; }
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      if (moved < 6) return;
      // on touch, a mostly vertical swipe walks the rail; horizontal looks around
      if (e.pointerType === 'touch' && !swipe && Math.abs(e.clientY - startY) > Math.abs(e.clientX - startX) * 1.3) swipe = true;
      if (swipe && this.onScroll) {
        this.onScroll((lastY - e.clientY) * 2.2);
        lastY = e.clientY;
      } else {
        const k = e.pointerType === 'touch' ? 0.0052 : 0.0034;
        this.offTarget.az = clamp(this.offTarget.az + dx * k, -1.4, 1.4);
        this.offTarget.pitch = clamp(this.offTarget.pitch + dy * k * 0.8, -0.5, 0.8);
      }
      this.touch();
    });
    const up = (e) => {
      const was = pts.has(e.pointerId);
      pts.delete(e.pointerId);
      if (pts.size === 0) this.dragging = false;
      if (was && moved <= 6 && performance.now() - downT < 600) this.onTap?.(e);
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  /** Place a camera exactly at a stop's pose (no smoothing, no breath). */
  static place(camera, pose) {
    const f = frameOf(pose);
    camera.position.set(f.ex, f.ey, f.ez);
    camera.lookAt(f.lx, f.ly, f.lz);
    camera.updateMatrixWorld();
  }

  update(dt, wallDt = dt) {
    const s = this.s;
    const base = this.rail ? this.rail() : s;
    this.off.az = damp(this.off.az, this.offTarget.az, 6, dt);
    this.off.pitch = damp(this.off.pitch, this.offTarget.pitch, 6, dt);
    // follow the rail softly so scroll input never feels mechanical
    for (const k of KEYS) s[k] = damp(s[k], base[k], 5.5, wallDt);
    const t = performance.now() / 1000;
    const breath = Math.sin(t * 0.9) * 0.012 + Math.sin(t * 0.31) * 0.01;
    const pos = new THREE.Vector3(s.ex, s.ey + breath, s.ez);
    // free look: turn the head around the eye
    const look = new THREE.Vector3(s.lx - s.ex, s.ly - s.ey, s.lz - s.ez);
    const len = look.length() || 1;
    let yaw = Math.atan2(look.x, look.z) - this.off.az;
    let pitch = clamp(Math.asin(clamp(look.y / len, -1, 1)) + this.off.pitch, -0.95, 1.45);
    const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    if (this.push) {
      // a short dolly towards a chosen anchor before leaving the page
      const pp = this.push;
      pp.t = Math.min(1, pp.t + dt / pp.d);
      const e = pp.t * pp.t * (3 - 2 * pp.t);
      const toward = pp.point.clone().sub(pos);
      pos.addScaledVector(toward, e * 0.5);
      dir.lerp(toward.normalize(), e).normalize();
    }
    this.camera.position.copy(pos);
    this.camera.lookAt(pos.clone().add(dir));
    this.pitchWorld = pitch;
  }
}
