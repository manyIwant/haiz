/**
 * HAIZ Campus Toybox V2 — Independent Character Art Inspection Studio Scene
 */

import { ToyboxRenderer, Node3D, Mesh3D, FABRIC } from '../engine/toybox3d.js';
import { createCylinder, createBox } from '../engine/geometry.js';
import { TOYBOX_THEMES } from '../verification/constants.js';
import { createToyboxCharacter } from '../toybox/characters.js';
import { exportNodeToGLB } from '../toybox/glbExporter.js';

export class CharacterStudioScene {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.themeId = options.theme || 'porcelain';
    this.renderer = new ToyboxRenderer(canvas, { preserveDrawingBuffer: Boolean(options.preserveDrawingBuffer) });
    this.root = new Node3D('studioRoot');

    this.yaw = 0.34;
    this.pitch = 0.16;
    this.distance = 2.82;
    this.autoRotate = Boolean(options.autoRotate);
    this.animMode = 'idle';

    this._elapsed = 0;
    this._rafId = null;
    this._lastTime = 0;
    this._destroyed = false;
    this.currentCharacter = null;

    this._buildTurntable();
    this.applyTheme(this.themeId);
    this.setCharacter(options.characterId || 'lanren-spirit');
    this._bindOrbitControls();
    this.resize();
  }

  _buildTurntable() {
    this.plinthMat = { color: [0.85, 0.80, 0.72], roughness: 0.72, metalness: 0.04, fuzz: 0.2, fabric: FABRIC.PLUSH, castShadow: false };
    this.ringMat = { color: [0.82, 0.70, 0.45], roughness: 0.26, metalness: 0.82, fuzz: 0.0, fabric: FABRIC.METAL, castShadow: false };

    const plinth = new Mesh3D(createCylinder(0.72, 0.78, 0.16, 40), this.plinthMat, 'plinth');
    plinth.position = [0, -0.08, 0];
    const brassRing = new Mesh3D(createCylinder(0.73, 0.73, 0.025, 40), this.ringMat, 'plinthRing');
    brassRing.position = [0, -0.005, 0];
    const floorPlane = new Mesh3D(createBox(8, 0.1, 8), this.plinthMat, 'studioFloor');
    floorPlane.position = [0, -0.21, 0];

    this.root.add(plinth, brassRing, floorPlane);
    this.charMount = new Node3D('charMount');
    this.root.add(this.charMount);
  }

  setCharacter(id) {
    if (this.currentCharacter) {
      this.charMount.remove(this.currentCharacter.root);
    }
    this.currentCharacter = createToyboxCharacter(id, { phaseOffset: 0 });
    this.currentCharacter.root.position = [0, 0, 0];
    this.currentCharacter.root.scale = [1.05, 1.05, 1.05];
    this.charMount.add(this.currentCharacter.root);
    return this.currentCharacter.meta;
  }

  setAnimationMode(mode) {
    this.animMode = mode;
    if (mode === 'bounce' && this.currentCharacter) {
      this.currentCharacter.triggerBounce();
      this.animMode = 'idle';
    }
  }

  setOrbit(yaw, pitch, distance) {
    if (typeof yaw === 'number') this.yaw = yaw;
    if (typeof pitch === 'number') this.pitch = Math.max(-0.2, Math.min(0.85, pitch));
    if (typeof distance === 'number') this.distance = Math.max(1.7, Math.min(4.2, distance));
  }

  applyTheme(themeId) {
    const t = TOYBOX_THEMES[themeId] || TOYBOX_THEMES.porcelain;
    this.themeId = t.id;
    this.renderer.clearColor = [...t.stageClear];
    this.plinthMat.color = [...t.floorColor];
    this.root.children.forEach((c) => {
      if (c.name === 'plinth' || c.name === 'studioFloor') c.material.color = [...t.floorColor];
    });
    this.renderer.lights.keyColor = [...t.keyColor];
    this.renderer.lights.fillColor = [...t.fillColor];
    this.renderer.lights.rimColor = [...t.rimColor];
    this.renderer.lights.skyColor = [...t.skyColor];
    this.renderer.lights.groundColor = [...t.groundColor];
    this.renderer.lights.exposure = t.exposure;
  }

  exportCurrentGLB() {
    if (!this.currentCharacter) return null;
    this.currentCharacter.animate(0, 0.016, 'idle', true);
    return exportNodeToGLB(this.currentCharacter.root, this.currentCharacter.id);
  }

  _bindOrbitControls() {
    let dragging = false;
    let lastX = 0, lastY = 0;

    this._onDown = (e) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      this.autoRotate = false;
      try { this.canvas.setPointerCapture(e.pointerId); } catch (_e) {}
    };
    this._onMove = (e) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      this.yaw -= dx * 0.012;
      this.pitch = Math.max(-0.12, Math.min(0.75, this.pitch + dy * 0.009));
    };
    this._onUp = () => { dragging = false; };
    this._onWheel = (e) => {
      e.preventDefault();
      this.distance = Math.max(1.7, Math.min(4.0, this.distance + e.deltaY * 0.002));
    };

    this.canvas.addEventListener('pointerdown', this._onDown);
    this.canvas.addEventListener('pointermove', this._onMove);
    this.canvas.addEventListener('pointerup', this._onUp);
    this.canvas.addEventListener('pointercancel', this._onUp);
    this.canvas.addEventListener('wheel', this._onWheel, { passive: false });
  }

  resize() {
    if (this._destroyed || !this.canvas) return;
    const parent = this.canvas.parentElement;
    const w = Math.max(240, parent ? parent.clientWidth : this.canvas.clientWidth || 420);
    const h = Math.max(240, parent ? parent.clientHeight : this.canvas.clientHeight || 360);
    this.renderer.setSize(w, h, 2.0);
  }

  start() {
    if (this._destroyed || this._rafId !== null) return;
    this._lastTime = performance.now();
    const tick = (now) => {
      if (this._destroyed) return;
      const dt = Math.min(0.05, Math.max(0.001, (now - this._lastTime) / 1000));
      this._lastTime = now;
      this.stepAndRender(dt);
      this._rafId = requestAnimationFrame(tick);
    };
    this._rafId = requestAnimationFrame(tick);
  }

  stepAndRender(dt = 0.016) {
    this._elapsed += dt;
    if (this.autoRotate) this.yaw += dt * 0.45;
    if (this.currentCharacter) {
      this.currentCharacter.animate(this._elapsed, dt, this.animMode, false);
    }
    const targetY = 0.49;
    const eye = [
      Math.sin(this.yaw) * Math.cos(this.pitch) * this.distance,
      targetY + Math.sin(this.pitch) * this.distance,
      Math.cos(this.yaw) * Math.cos(this.pitch) * this.distance
    ];
    this.renderer.render(this.root, {
      fov: 30,
      eye,
      target: [0, targetY, 0],
      shadowTarget: [0, 0.2, 0],
      shadowExtent: 1.8
    });
  }

  destroy() {
    this._destroyed = true;
    if (this._rafId !== null) cancelAnimationFrame(this._rafId);
    this.canvas.removeEventListener('pointerdown', this._onDown);
    this.canvas.removeEventListener('pointermove', this._onMove);
    this.canvas.removeEventListener('pointerup', this._onUp);
    this.canvas.removeEventListener('pointercancel', this._onUp);
    this.canvas.removeEventListener('wheel', this._onWheel);
    this.renderer.destroy();
  }
}
