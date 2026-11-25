/**
 * Browser ES-module adaptation of Kando's GestureDetector.
 *
 * Original source:
 *   https://github.com/kando-menu/kando/blob/main/src/menu-renderer/input-methods/gesture-detector.ts
 *   SPDX-FileCopyrightText: Simon Schneegans <code@simonschneegans.de>
 *   SPDX-License-Identifier: MIT
 *
 * Detects marking-menu selections during a single continuous stroke:
 * Emits a selection at pivot corner E whenever either:
 *   1. The pointer makes a sharp turn between S->E and E->M (> minStrokeAngle), OR
 *   2. The pointer pauses briefly after travelling > minStrokeLength (pauseTimeout).
 */

export class KandoGestureDetector {
  constructor({
    minStrokeLength = 92,
    minStrokeAngle = 24,
    jitterThreshold = 8,
    pauseTimeout = 150,
    onSelection = () => {},
  } = {}) {
    this.minStrokeLength = minStrokeLength;
    this.minStrokeAngle = minStrokeAngle;
    this.jitterThreshold = jitterThreshold;
    this.pauseTimeout = pauseTimeout;
    this.onSelection = onSelection;

    this.strokeStart = null;
    this.strokeEnd = null;
    this.timeout = null;
  }

  onMotionEvent(coords) {
    if (this.strokeStart === null) {
      this.strokeStart = { x: coords.x, y: coords.y };
      this.strokeEnd = { x: coords.x, y: coords.y };
      return;
    }

    const strokeDir = {
      x: this.strokeEnd.x - this.strokeStart.x,
      y: this.strokeEnd.y - this.strokeStart.y,
    };
    const strokeLength = Math.hypot(strokeDir.x, strokeDir.y);

    if (strokeLength > this.minStrokeLength) {
      const tipDir = {
        x: coords.x - this.strokeEnd.x,
        y: coords.y - this.strokeEnd.y,
      };
      const tipLength = Math.hypot(tipDir.x, tipDir.y);

      if (tipLength > this.jitterThreshold) {
        if (this.timeout !== null) {
          clearTimeout(this.timeout);
          this.timeout = null;
        }

        const dot =
          (tipDir.x / tipLength) * (strokeDir.x / strokeLength) +
          (tipDir.y / tipLength) * (strokeDir.y / strokeLength);
        const angleDeg = (Math.acos(Math.max(-1, Math.min(1, dot))) * 180) / Math.PI;

        if (angleDeg > this.minStrokeAngle) {
          const pivot = { x: this.strokeEnd.x, y: this.strokeEnd.y };
          this.reset(pivot);
          this.onSelection(pivot, 'corner');
          return;
        }

        this.strokeEnd = { x: coords.x, y: coords.y };

        // Schedule pause-selection if pointer becomes stationary
        this.timeout = setTimeout(() => {
          this.timeout = null;
          if (this.strokeEnd) {
            const pivot = { x: this.strokeEnd.x, y: this.strokeEnd.y };
            this.reset(pivot);
            this.onSelection(pivot, 'pause');
          }
        }, this.pauseTimeout);
      }
    } else {
      this.strokeEnd = { x: coords.x, y: coords.y };
    }
  }

  reset(nextStart = null) {
    if (this.timeout !== null) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    this.strokeStart = nextStart ? { x: nextStart.x, y: nextStart.y } : null;
    this.strokeEnd = nextStart ? { x: nextStart.x, y: nextStart.y } : null;
  }
}
