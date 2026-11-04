// A camera for standing under a tree.
// The homepage drives it along a rail of frames (scroll = walking around and
// up the tree); dragging adds a free look on top that eases back when the
// walk resumes. No cuts: every move is continuous.
import * as THREE from 'three';
import { poseAt } from './chapters.js';

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const damp = (cur, target, lambda, dt) => target + (cur - target) * Math.exp(-lambda * dt);
const KEYS = ['ex', 'ey', 'ez', 'lx', 'ly', 'lz', 'fov'];

export class DwellCamera {
  constructor(camera, dom) {
    this.camera = camera;
    this.dom = dom;
    this.s = { ex: 6, ey: 1, ez: 33, lx: 2.5, ly: 5.6, lz: 0.4, fov: 40 };
    this.rail = null;             // () => frame
    this.off = { az: 0, pitch: 0 };
    this.offTarget = { az: 0, pitch: 0 };
    this.lastInput = performance.now();
    this.dragging = false;
    this.enabled = true;
    this.onTap = null;
    this.onHover = null;
    this.push = null;             // transition push towards a point
    this._bind();
  }

  idleSeconds() { return (performance.now() - this.lastInput) / 1000; }
  touch() { this.lastInput = performance.now(); }
  releaseLook() { this.offTarget.az = 0; this.offTarget.pitch = 0; }
  snap() { if (this.rail) Object.assign(this.s, this.rail()); }

  _bind() {
    // Vertical scrolling stays native (wheel, trackpad, touch); a drag looks around.
    const el = this.dom;
    const pts = new Map();
    let moved = 0, downT = 0;
    el.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved = 0; downT = performance.now();
      if (e.pointerType !== 'touch') el.setPointerCapture?.(e.pointerId);
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
      const k = e.pointerType === 'touch' ? 0.005 : 0.0032;
      this.offTarget.az = clamp(this.offTarget.az + dx * k, -1.2, 1.2);
      if (e.pointerType !== 'touch') this.offTarget.pitch = clamp(this.offTarget.pitch + dy * k * 0.8, -0.45, 0.7);
      this.touch();
    });
    const up = (e) => {
      const was = pts.has(e.pointerId);
      pts.delete(e.pointerId);
      if (pts.size === 0) this.dragging = false;
      if (was && moved <= 6 && performance.now() - downT < 600 && e.type === 'pointerup') this.onTap?.(e);
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  /** Place a camera exactly at a stop's pose (no smoothing, no breath). */
  static place(camera, i) {
    const f = poseAt(i);
    camera.position.set(f.ex, f.ey, f.ez);
    camera.lookAt(f.lx, f.ly, f.lz);
    camera.fov = DwellCamera.fovFor(f.fov, camera.aspect);
    DwellCamera.applyShift(camera);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  /** Shots are composed for a 16:9 frame; narrower screens widen the lens to keep the subject. */
  static fovFor(fov, aspect) {
    const ref = 16 / 9;
    if (aspect >= ref) return fov;
    const t = Math.tan((fov * Math.PI) / 360) * Math.min(2.1, Math.pow(ref / aspect, 0.72)) * DwellCamera.shiftFor(aspect);
    return Math.min(110, (Math.atan(t) * 360) / Math.PI);
  }

  /** Portrait screens keep their lower part for words and links: a lens shift
   *  (not a tilt) lifts the subject into the upper part of the frame. */
  static shiftFor(aspect) { return aspect < 0.85 ? 1.32 : 1; }
  static applyShift(camera) {
    const k = DwellCamera.shiftFor(camera.aspect);
    if (k > 1) camera.setViewOffset(1, k, 0, k - 1, 1, 1);
    else if (camera.view && camera.view.enabled) camera.clearViewOffset();
  }

  update(dt, wallDt = dt) {
    const s = this.s;
    const base = this.rail ? this.rail() : s;
    this.off.az = damp(this.off.az, this.offTarget.az, 6, dt);
    this.off.pitch = damp(this.off.pitch, this.offTarget.pitch, 6, dt);
    // follow the rail softly so scroll input never feels mechanical
    for (const k of KEYS) s[k] = damp(s[k], base[k], 6.5, wallDt);
    const t = performance.now() / 1000;
    const breath = Math.sin(t * 0.9) * 0.012 + Math.sin(t * 0.31) * 0.01;
    const pos = new THREE.Vector3(s.ex, s.ey + breath, s.ez);
    // free look: turn the head around the eye
    const look = new THREE.Vector3(s.lx - s.ex, s.ly - s.ey, s.lz - s.ez);
    const len = look.length() || 1;
    let yaw = Math.atan2(look.x, look.z) - this.off.az;
    let pitch = clamp(Math.asin(clamp(look.y / len, -1, 1)) + this.off.pitch, -1.52, 1.52);
    const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    // portrait screens see less sideways: step back along the view so the subject still fits
    const fov = DwellCamera.fovFor(s.fov, this.camera.aspect);
    const shifted = DwellCamera.shiftFor(this.camera.aspect) > 1;
    if (Math.abs(fov - this.camera.fov) > 0.01 || shifted !== !!this.camera.view?.enabled) {
      this.camera.fov = fov;
      DwellCamera.applyShift(this.camera);
      this.camera.updateProjectionMatrix();
    }
    if (this.push) {
      // a short dolly towards a chosen anchor before leaving the page
      const pp = this.push;
      pp.t = Math.min(1, pp.t + dt / pp.d);
      const e = pp.t * pp.t * (3 - 2 * pp.t);
      const toward = pp.point.clone().sub(pos);
      const dist = toward.length();
      toward.normalize();
      pos.addScaledVector(toward, e * Math.min(dist * 0.5, 3));   // a short push, never a flight
      dir.lerp(toward, e * 0.6).normalize();
    }
    this.camera.position.copy(pos);
    this.camera.lookAt(pos.clone().add(dir));
    this.pitchWorld = pitch;
  }
}
