/**
 * HAIZ Human Verification — Tactile Physical Console & Input Controller
 * Handles physical joystick pointer/touch drag, keyboard controls, and touch-scroll isolation.
 */

export class ConsoleController {
  constructor(elements, callbacks = {}) {
    this.joystickEl = elements.joystickEl;
    this.joystickShaftEl = elements.joystickShaftEl;
    this.joystickKnobEl = elements.joystickKnobEl;
    this.actionBtnEl = elements.actionBtnEl;
    this.stageEl = elements.stageEl;

    this.onAction = callbacks.onAction || (() => {});
    this.onCancel = callbacks.onCancel || (() => {});
    this.onFirstGesture = callbacks.onFirstGesture || (() => {});
    this.onInputSample = callbacks.onInputSample || (() => {});

    this._pointerId = null;
    this._originX = 0;
    this._originY = 0;
    this._joyX = 0;
    this._joyY = 0;
    this._keys = { left: false, right: false };
    this._lastModality = 'joystick';
    this._enabled = true;
    this._bound = [];

    this._bindEvents();
  }

  get lastModality() {
    return this._lastModality;
  }

  getHorizontalInput() {
    if (!this._enabled) return 0;
    const keyAxis = (this._keys.right ? 1 : 0) - (this._keys.left ? 1 : 0);
    if (keyAxis !== 0) return keyAxis;
    return this._joyX;
  }

  setEnabled(flag) {
    this._enabled = Boolean(flag);
    if (!this._enabled) {
      this._resetJoystick();
      this._keys.left = false;
      this._keys.right = false;
    }
  }

  _listen(target, type, handler, options) {
    if (!target) return;
    target.addEventListener(type, handler, options);
    this._bound.push(() => target.removeEventListener(type, handler, options));
  }

  _bindEvents() {
    // Physical Joystick pointer interaction
    this._listen(this.joystickEl, 'pointerdown', (e) => {
      if (!this._enabled) return;
      e.preventDefault();
      this.onFirstGesture();
      this._pointerId = e.pointerId;
      this._lastModality = e.pointerType === 'touch' ? 'touch' : 'joystick';
      const rect = this.joystickEl.getBoundingClientRect();
      this._originX = rect.left + rect.width / 2;
      this._originY = rect.top + rect.height / 2;
      try {
        this.joystickEl.setPointerCapture(e.pointerId);
      } catch (_err) {}
      this._updateJoystickFromClient(e.clientX, e.clientY);
    });

    this._listen(this.joystickEl, 'pointermove', (e) => {
      if (this._pointerId !== e.pointerId || !this._enabled) return;
      e.preventDefault();
      this._updateJoystickFromClient(e.clientX, e.clientY);
    });

    const releaseJoy = (e) => {
      if (this._pointerId !== e.pointerId) return;
      this._pointerId = null;
      this._resetJoystick();
    };
    this._listen(this.joystickEl, 'pointerup', releaseJoy);
    this._listen(this.joystickEl, 'pointercancel', releaseJoy);

    // Direct touch/drag horizontal steering on the 3D glass viewport (convenient on mobile)
    let stagePointerId = null;
    let stageLastX = 0;
    this._listen(this.stageEl, 'pointerdown', (e) => {
      if (!this._enabled) return;
      this.onFirstGesture();
      stagePointerId = e.pointerId;
      stageLastX = e.clientX;
      this._lastModality = e.pointerType === 'touch' ? 'touch' : 'joystick';
    });
    this._listen(this.stageEl, 'pointermove', (e) => {
      if (stagePointerId !== e.pointerId || !this._enabled) return;
      const dx = e.clientX - stageLastX;
      this._joyX = Math.max(-1, Math.min(1, dx / 44));
      this._renderJoystickVisual(this._joyX, 0);
      this.onInputSample();
    });
    const endStageDrag = (e) => {
      if (stagePointerId !== e.pointerId) return;
      stagePointerId = null;
      this._resetJoystick();
    };
    this._listen(this.stageEl, 'pointerup', endStageDrag);
    this._listen(this.stageEl, 'pointercancel', endStageDrag);

    // Tactile Push Button
    this._listen(this.actionBtnEl, 'pointerdown', () => {
      this.onFirstGesture();
    });
    this._listen(this.actionBtnEl, 'click', () => {
      if (!this._enabled) return;
      this.onFirstGesture();
      this.onAction();
    });

    // Keyboard controls (ArrowLeft/Right, A/D, Space/Enter, Escape)
    this._listen(window, 'keydown', (e) => {
      if (!this._enabled) return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        this.onFirstGesture();
        this._keys.left = true;
        this._lastModality = 'keyboard';
        this._renderJoystickVisual(-0.85, 0);
        this.onInputSample();
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        this.onFirstGesture();
        this._keys.right = true;
        this._lastModality = 'keyboard';
        this._renderJoystickVisual(0.85, 0);
        this.onInputSample();
      } else if (e.code === 'Space') {
        // Avoid hijacking space if focused on a secondary button
        if (document.activeElement && document.activeElement.dataset && document.activeElement.dataset.hvSecondary === 'true') {
          return;
        }
        e.preventDefault();
        this.onFirstGesture();
        this._lastModality = 'keyboard';
        this._triggerButtonVisualPress();
        this.onAction();
      } else if (e.key === 'Escape') {
        this.onCancel();
      }
    });

    this._listen(window, 'keyup', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        this._keys.left = false;
        this._renderJoystickVisual(this._keys.right ? 0.85 : 0, 0);
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        this._keys.right = false;
        this._renderJoystickVisual(this._keys.left ? -0.85 : 0, 0);
      }
    });
  }

  _updateJoystickFromClient(clientX, clientY) {
    const maxRadius = 24;
    const dx = clientX - this._originX;
    const dy = clientY - this._originY;
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(maxRadius, dist);
    const angle = Math.atan2(dy, dx);
    const nx = dist > 1 ? (Math.cos(angle) * clampedDist) / maxRadius : 0;
    const ny = dist > 1 ? (Math.sin(angle) * clampedDist) / maxRadius : 0;
    this._joyX = nx;
    this._joyY = ny;
    this._renderJoystickVisual(nx, ny);
    this.onInputSample();
  }

  _resetJoystick() {
    this._joyX = 0;
    this._joyY = 0;
    this._renderJoystickVisual(0, 0);
  }

  _renderJoystickVisual(nx, ny) {
    if (!this.joystickKnobEl || !this.joystickShaftEl) return;
    const tx = nx * 13;
    const ty = ny * 7;
    const tiltDeg = nx * 24;
    this.joystickKnobEl.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0)`;
    this.joystickShaftEl.style.transform = `translateX(-50%) rotate(${tiltDeg.toFixed(1)}deg)`;
  }

  _triggerButtonVisualPress() {
    if (!this.actionBtnEl) return;
    this.actionBtnEl.classList.add('is-pressed');
    setTimeout(() => {
      if (this.actionBtnEl) this.actionBtnEl.classList.remove('is-pressed');
    }, 150);
  }

  destroy() {
    this._bound.forEach((off) => off());
    this._bound.length = 0;
  }
}
