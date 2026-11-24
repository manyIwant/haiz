/**
 * HAIZ Toybox V2 — Tactile Machine Console & Input Controller
 */

export class ConsoleController {
  constructor(elements, callbacks = {}) {
    this.joystickEl = elements.joystickEl;
    this.shaftEl = elements.shaftEl;
    this.knobEl = elements.knobEl;
    this.actionBtnEl = elements.actionBtnEl;
    this.stageEl = elements.stageEl;

    this.onAction = callbacks.onAction || (() => {});
    this.onCancel = callbacks.onCancel || (() => {});
    this.onFirstGesture = callbacks.onFirstGesture || (() => {});

    this._pointerId = null;
    this._originX = 0;
    this._originY = 0;
    this._joyX = 0;
    this._joyY = 0;
    this._keys = { left: false, right: false };
    this._lastModality = 'joystick';
    this._enabled = true;
    this._cleanups = [];

    this._bind();
  }

  get lastModality() { return this._lastModality; }

  getHorizontalInput() {
    if (!this._enabled) return 0;
    const k = (this._keys.right ? 1 : 0) - (this._keys.left ? 1 : 0);
    return k !== 0 ? k : this._joyX;
  }

  setEnabled(flag) {
    this._enabled = Boolean(flag);
    if (!this._enabled) {
      this._resetJoy();
      this._keys.left = false;
      this._keys.right = false;
    }
  }

  _on(target, type, fn, opts) {
    if (!target) return;
    target.addEventListener(type, fn, opts);
    this._cleanups.push(() => target.removeEventListener(type, fn, opts));
  }

  _bind() {
    this._on(this.joystickEl, 'pointerdown', (e) => {
      if (!this._enabled) return;
      e.preventDefault();
      this.onFirstGesture();
      this._pointerId = e.pointerId;
      this._lastModality = e.pointerType === 'touch' ? 'touch' : 'joystick';
      const rect = this.joystickEl.getBoundingClientRect();
      this._originX = rect.left + rect.width / 2;
      this._originY = rect.top + rect.height / 2;
      try { this.joystickEl.setPointerCapture(e.pointerId); } catch (_err) {}
      this._updateJoy(e.clientX, e.clientY);
    });

    this._on(this.joystickEl, 'pointermove', (e) => {
      if (this._pointerId !== e.pointerId || !this._enabled) return;
      e.preventDefault();
      this._updateJoy(e.clientX, e.clientY);
    });

    const endJoy = (e) => {
      if (this._pointerId !== e.pointerId) return;
      this._pointerId = null;
      this._resetJoy();
    };
    this._on(this.joystickEl, 'pointerup', endJoy);
    this._on(this.joystickEl, 'pointercancel', endJoy);

    let stagePid = null;
    let stageStartX = 0;
    this._on(this.stageEl, 'pointerdown', (e) => {
      if (!this._enabled) return;
      this.onFirstGesture();
      stagePid = e.pointerId;
      stageStartX = e.clientX;
      this._lastModality = e.pointerType === 'touch' ? 'touch' : 'joystick';
    });
    this._on(this.stageEl, 'pointermove', (e) => {
      if (stagePid !== e.pointerId || !this._enabled) return;
      const dx = e.clientX - stageStartX;
      this._joyX = Math.max(-1, Math.min(1, dx / 42));
      this._renderJoy(this._joyX, 0);
    });
    const endStage = (e) => {
      if (stagePid !== e.pointerId) return;
      stagePid = null;
      this._resetJoy();
    };
    this._on(this.stageEl, 'pointerup', endStage);
    this._on(this.stageEl, 'pointercancel', endStage);

    this._on(this.actionBtnEl, 'pointerdown', () => this.onFirstGesture());
    this._on(this.actionBtnEl, 'click', () => {
      if (!this._enabled) return;
      this.onFirstGesture();
      this.onAction();
    });

    this._on(window, 'keydown', (e) => {
      if (!this._enabled) return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        this.onFirstGesture();
        this._keys.left = true;
        this._lastModality = 'keyboard';
        this._renderJoy(-0.85, 0);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        this.onFirstGesture();
        this._keys.right = true;
        this._lastModality = 'keyboard';
        this._renderJoy(0.85, 0);
      } else if (e.code === 'Space') {
        if (document.activeElement && document.activeElement.dataset && document.activeElement.dataset.tbSecondary === 'true') {
          return;
        }
        e.preventDefault();
        this.onFirstGesture();
        this._lastModality = 'keyboard';
        this._pressBtnVisual();
        this.onAction();
      } else if (e.key === 'Escape') {
        this.onCancel();
      }
    });

    this._on(window, 'keyup', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        this._keys.left = false;
        this._renderJoy(this._keys.right ? 0.85 : 0, 0);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        this._keys.right = false;
        this._renderJoy(this._keys.left ? -0.85 : 0, 0);
      }
    });
  }

  _updateJoy(cx, cy) {
    const r = 24;
    const dx = cx - this._originX;
    const dy = cy - this._originY;
    const d = Math.hypot(dx, dy);
    const cd = Math.min(r, d);
    const a = Math.atan2(dy, dx);
    this._joyX = d > 1 ? (Math.cos(a) * cd) / r : 0;
    this._joyY = d > 1 ? (Math.sin(a) * cd) / r : 0;
    this._renderJoy(this._joyX, this._joyY);
  }

  _resetJoy() {
    this._joyX = 0;
    this._joyY = 0;
    this._renderJoy(0, 0);
  }

  _renderJoy(nx, ny) {
    if (!this.knobEl || !this.shaftEl) return;
    this.knobEl.style.transform = `translate3d(${(nx * 13).toFixed(1)}px, ${(ny * 7).toFixed(1)}px, 0)`;
    this.shaftEl.style.transform = `translateX(-50%) rotate(${(nx * 24).toFixed(1)}deg)`;
  }

  _pressBtnVisual() {
    if (!this.actionBtnEl) return;
    this.actionBtnEl.classList.add('is-pressed');
    setTimeout(() => { if (this.actionBtnEl) this.actionBtnEl.classList.remove('is-pressed'); }, 150);
  }

  destroy() {
    this._cleanups.forEach((fn) => fn());
    this._cleanups.length = 0;
  }
}
