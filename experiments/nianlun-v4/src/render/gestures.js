/**
 * HAIZ · NIANLUN · 一卷 V4 — Unified Multi-Touch, Jog-Dial, Fog-Drag & One-Handed Gesture Engine
 *
 * Handles:
 *  - 2-finger pinch-to-stretch (Gaussian σ=1.1, anchored under finger midpoint, snap w<0.30 to roll)
 *  - 1-finger annual-ring end-face circular jog dial (2π/7 = 1 day, live adjacent lookup!)
 *  - 1-finger Fog drag across days to condense ("周X（我估计）") or drag away to disperse
 *  - 1-finger edge height handle for one-handed stretch/squeeze
 *  - 1-finger vertical scroll with natural inertia
 *  - Long-press on Roll -> accessible button menu ("展开一周 / 展开一天 / 卷回")
 *  - Tap / Double-tap on days, items, walls, fog clusters
 *  - Desktop Ctrl+Wheel (or trackpad pinch) & standard wheel scrolling
 */

import {
  ROLL_THRESHOLD_LIVE,
  applyGaussianStretch,
  snapCompressedDaysToRolls,
  computeReadingThresholds,
} from '../core/layout.js';
import { WEEKDAY_LABELS } from '../core/model.js';
import { foley } from '../ui/foley.js';

const TAU = Math.PI * 2;
const DAY_STEP_RAD = TAU / 7;

export class ScrollGestureController {
  constructor(canvas, renderer, store, callbacks) {
    this.canvas = canvas;
    this.renderer = renderer;
    this.store = store;
    this.callbacks = callbacks; // { onSelectItem, onOpenReturnWall, onOpenRollMenu, onOpenFogCluster, onFirstTouch, onMutated }

    this.pointers = new Map();
    this.pinch = null;
    this.drag = null;
    this.jog = null;
    this.fogDrag = null;
    this.handleDrag = null;
    this.longPressTimer = null;

    this.moved = false;
    this.lastTapMs = 0;
    this.lastTapDayIdx = -1;
    this.animFrame = 0;
    this.glideFrame = 0;
    this.wheelSnapTimer = null;

    this._bindEvents();
  }

  isReducedMotion() {
    const mediaReduce = typeof window !== 'undefined'
      && window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return Boolean(mediaReduce || this.store.state.reducedMotionOverride);
  }

  kickAnimation() {
    this.renderer.reducedMotion = this.isReducedMotion();
    if (this.renderer.reducedMotion) {
      for (const d of this.store.days) d.w = d.tw;
      this.renderer.draw();
      this.callbacks.onMutated && this.callbacks.onMutated();
      return;
    }
    if (this.animFrame) return;

    const tick = () => {
      let moving = false;
      for (const d of this.store.days) {
        const diff = d.tw - d.w;
        if (Math.abs(diff) > 0.0025) {
          d.w += diff * 0.24;
          moving = true;
        } else {
          d.w = d.tw;
        }
      }
      // Keep running while any fly-in ripple is active
      const nowMs = Date.now();
      const hasFlyIn = this.store.state.items.some((it) => it.flyInAt && nowMs - it.flyInAt < 1100);
      this.renderer.draw();
      if (moving || hasFlyIn) {
        this.animFrame = requestAnimationFrame(tick);
      } else {
        this.animFrame = 0;
        this.callbacks.onMutated && this.callbacks.onMutated();
      }
    };
    this.animFrame = requestAnimationFrame(tick);
  }

  _clearLongPress() {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  _localPoint(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  _hitTest(x, y) {
    // Check in reverse order so top-most overlays (walls, fogs, handles, items) win cleanly
    const regions = this.renderer.hitRegions;
    for (let i = regions.length - 1; i >= 0; i--) {
      const reg = regions[i];
      if (x >= reg.x && x <= reg.x + reg.w && y >= reg.y && y <= reg.y + reg.h) {
        return reg;
      }
    }
    return null;
  }

  /** Unroll a rolled segment (1 week nearest the expanded edge, or all if <= 10 days) */
  unrollSegment(seg, countDays = 7) {
    this.store.pushUndo('展开卷起的时间');
    const days = this.store.days;
    const n = seg.to - seg.from + 1;
    let a = seg.from;
    let b = seg.to;
    if (n > countDays + 2) {
      if (seg.position === 'past') {
        a = Math.max(seg.from, seg.to - (countDays - 1));
      } else {
        b = Math.min(seg.to, seg.from + (countDays - 1));
      }
    }
    for (let i = a; i <= b; i++) {
      days[i].tw = 1;
      if (days[i].w < ROLL_THRESHOLD_LIVE) days[i].w = ROLL_THRESHOLD_LIVE * 1.05;
    }
    foley.rollSnap(this.store.state.soundEnabled);
    this.store.persist();
    this.kickAnimation();
  }

  /** Wind 1 single day out (+1) or back in (-1) adjacent to a specific roll (§4.3) */
  windOneDay(rollPosition, dir, anchorRollSeg = null) {
    const days = this.store.days;
    const nowIdx = this.store.nowIdx;
    const isRolled = (d) => d.tw < ROLL_THRESHOLD_LIVE;
    let targetIdx = -1;

    if (rollPosition === 'past') {
      if (dir > 0) {
        // Unroll newest rolled day before Now
        for (let j = nowIdx - 1; j >= 0; j--) {
          if (isRolled(days[j])) { targetIdx = j; break; }
        }
      } else {
        // Roll back oldest expanded day before Now
        for (let j = 0; j < nowIdx; j++) {
          if (!isRolled(days[j])) { targetIdx = j; break; }
        }
      }
    } else if (rollPosition === 'future') {
      if (dir > 0) {
        // Unroll earliest rolled day after Now
        for (let j = nowIdx + 1; j < days.length; j++) {
          if (isRolled(days[j])) { targetIdx = j; break; }
        }
      } else {
        // Roll back latest expanded day after Now
        for (let j = days.length - 1; j > nowIdx; j--) {
          if (!isRolled(days[j])) { targetIdx = j; break; }
        }
      }
    } else if (rollPosition === 'middle' && anchorRollSeg) {
      if (dir > 0) {
        for (let j = anchorRollSeg.from; j <= anchorRollSeg.to; j++) {
          if (isRolled(days[j])) { targetIdx = j; break; }
        }
      } else {
        // Roll an adjacent day into the middle roll
        const leftCandidate = anchorRollSeg.from - 1;
        if (leftCandidate >= 0 && leftCandidate !== nowIdx && !isRolled(days[leftCandidate])) {
          targetIdx = leftCandidate;
        }
      }
    }

    if (targetIdx < 0) return null;

    if (dir > 0) {
      days[targetIdx].tw = 1;
      days[targetIdx].w = ROLL_THRESHOLD_LIVE * 1.08;
    } else {
      days[targetIdx].tw = 0;
    }
    const d = days[targetIdx];
    foley.dialTick(this.store.state.soundEnabled, d.wd === 0);
    this.store.persist();
    this.kickAnimation();
    return d;
  }

  /** Expand a day cleanly to its List or Hour-Scale mode */
  expandDayToMode(dayIdx, targetMode = 'list') {
    const d = this.store.days[dayIdx];
    if (!d) return;
    this.store.pushUndo(targetMode === 'hour' ? '进入时刻读法' : '展开这一天');
    const itemsCount = (this.renderer._itemsByDay && this.renderer._itemsByDay[dayIdx])
      ? this.renderer._itemsByDay[dayIdx].filter((x) => !x.isReturnWall).length
      : 0;
    const t = computeReadingThresholds(d, itemsCount);
    const seg = this.renderer.segs.find((s) => !s.roll && s.i === dayIdx);
    const baseH = seg ? seg.baseH : 58;

    if (targetMode === 'hour') {
      const targetH = Math.max(t.timeMinH + 64, 410);
      d.tw = Math.min(12.5, Math.max(d.tw, targetH / Math.max(24, baseH)));
    } else if (targetMode === 'full_list') {
      const targetH = t.headerH + Math.max(1, itemsCount) * 44 + 20;
      d.tw = Math.min(12.5, Math.max(d.tw, targetH / Math.max(24, baseH)));
    } else {
      const targetH = t.listMinH + 18;
      d.tw = Math.min(12.5, Math.max(d.tw, targetH / Math.max(24, baseH)));
    }
    if (d.w < ROLL_THRESHOLD_LIVE) d.w = ROLL_THRESHOLD_LIVE * 1.1;
    this.store.persist();
    this.kickAnimation();
  }

  /** Focus & scroll smoothly to any specific date ISO (unrolling if needed!) */
  jumpToDateIso(iso, expandMode = 'list') {
    const idx = this.store.days.findIndex((d) => d.iso === iso);
    if (idx < 0) return;
    this.store.pushUndo(`跳转到 ${iso}`);
    // Unroll target day and its immediate neighbors for spatial context
    for (let k = Math.max(0, idx - 1); k <= Math.min(this.store.days.length - 1, idx + 1); k++) {
      if (this.store.days[k].tw < 0.8) {
        this.store.days[k].tw = 1;
        this.store.days[k].w = Math.max(this.store.days[k].w, ROLL_THRESHOLD_LIVE * 1.1);
      }
    }
    if (expandMode) this.expandDayToMode(idx, expandMode);
    this.renderer.recomputeLayout();
    const targetSeg = this.renderer.segs.find((s) => !s.roll && s.i === idx);
    if (targetSeg) {
      this.renderer.scrollOffset = Math.max(0, targetSeg.y - Math.min(120, this.renderer.height * 0.22));
      this.renderer.clampScroll();
    }
    this.kickAnimation();
  }

  _bindEvents() {
    const cv = this.canvas;

    cv.addEventListener('pointerdown', (e) => {
      try { cv.setPointerCapture(e.pointerId); } catch { /* synthetic events */ }
      if (this.glideFrame) {
        cancelAnimationFrame(this.glideFrame);
        this.glideFrame = 0;
      }
      this.callbacks.onFirstTouch && this.callbacks.onFirstTouch();

      const p = this._localPoint(e);
      this.pointers.set(e.pointerId, p);
      this.moved = false;
      this._clearLongPress();

      // TWO-FINGER PINCH-TO-STRETCH (§3.1)
      if (this.pointers.size === 2) {
        this.drag = null;
        this.jog = null;
        this.fogDrag = null;
        this.handleDrag = null;
        this.renderer.draggingFog = null;
        this.renderer.activeHandleDayIdx = null;
        this.store.pushUndo('缩放时间密度');

        const [a, b] = [...this.pointers.values()];
        const span = Math.max(18, Math.abs(a.y - b.y) + 0.55 * Math.abs(a.x - b.x));
        const midY = (a.y + b.y) / 2;
        this.pinch = {
          span,
          midY,
          fi: this.renderer.fractionalDayIndexAt(midY),
        };
        return;
      }

      if (this.pointers.size !== 1) return;

      // 1. Check Annual-Ring End-Face Jog Dial hit FIRST!
      for (const box of this.renderer.rollHitBoxes) {
        if (Math.hypot(p.x - box.cx, p.y - box.cy) <= box.R + 14) {
          this.store.pushUndo('拨动年轮端面');
          this.jog = {
            rollPosition: box.seg.position,
            seg: box.seg,
            cx: box.cx,
            cy: box.cy,
            lastAngle: Math.atan2(p.y - box.cy, p.x - box.cx),
            accum: 0,
          };
          this.renderer.activeJog = { rollPosition: box.seg.position, toastText: '转圈逐日卷出' };
          this.renderer.draw();
          return;
        }
      }

      // 2. Check Roll body (long press -> accessible roll menu; tap -> unroll week)
      const hitRoll = this.renderer.rollHitBoxes.find((b) => p.y >= b.y && p.y <= b.y + b.h);
      if (hitRoll) {
        this.longPressTimer = setTimeout(() => {
          if (!this.moved && this.drag) {
            this.drag = null;
            this.callbacks.onOpenRollMenu && this.callbacks.onOpenRollMenu(hitRoll.seg);
          }
        }, 520);
        this.drag = { startY: p.y, startOff: this.renderer.scrollOffset, vel: 0, lastT: performance.now(), hitRoll: hitRoll.seg };
        return;
      }

      // 3. Check Single-Finger Edge Stretch Handle (One-Handed Accessibility! §9.6)
      const hit = this._hitTest(p.x, p.y);
      if (hit && hit.kind === 'stretch_handle') {
        const d = this.store.days[hit.dayIdx];
        const seg = this.renderer.segs.find((s) => !s.roll && s.i === hit.dayIdx);
        this.store.pushUndo('单指调整这一天长度');
        this.handleDrag = {
          dayIdx: hit.dayIdx,
          startY: p.y,
          startW: d.w,
          baseH: seg ? seg.baseH : 60,
        };
        this.renderer.activeHandleDayIdx = hit.dayIdx;
        this.renderer.draw();
        return;
      }

      // 4. Check Draggable Fog Veil (condense onto a day by dragging! §5.1)
      if (hit && hit.kind === 'fog') {
        const item = this.store.state.items.find((it) => it.id === hit.itemId);
        if (item) {
          this.fogDrag = {
            item,
            startX: p.x,
            startY: p.y,
            active: false,
          };
          return;
        }
      }

      // 5. Default: smooth vertical scroll drag
      this.drag = {
        startY: p.y,
        startOff: this.renderer.scrollOffset,
        vel: 0,
        lastT: performance.now(),
        hitAtDown: hit,
      };
    });

    cv.addEventListener('pointermove', (e) => {
      if (!this.pointers.has(e.pointerId)) return;
      const p = this._localPoint(e);
      this.pointers.set(e.pointerId, p);

      // Two-finger pinch stretch
      if (this.pinch && this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const span = Math.max(18, Math.abs(a.y - b.y) + 0.55 * Math.abs(a.x - b.x));
        const factor = span / this.pinch.span;
        if (this.pinch.fi != null && Math.abs(factor - 1) > 0.004) {
          applyGaussianStretch(this.store.days, this.pinch.fi, factor);
          this.renderer.anchorFractionalDay(this.pinch.fi, this.pinch.midY);
          this.renderer.draw();
        }
        this.pinch.span = span;
        this.moved = true;
        return;
      }

      // Annual-ring jog dial rotation
      if (this.jog) {
        const ang = Math.atan2(p.y - this.jog.cy, p.x - this.jog.cx);
        let da = ang - this.jog.lastAngle;
        if (da > Math.PI) da -= TAU;
        if (da < -Math.PI) da += TAU;
        this.jog.lastAngle = ang;
        this.jog.accum += da;

        // Persist visual spin angle on the roll boundary day
        const spinHost = this.store.days[this.jog.seg.from];
        if (spinHost) spinHost._rollSpin = (spinHost._rollSpin || 0) + da;
        if (Math.abs(da) > 0.02) this.moved = true;

        while (this.jog.accum >= DAY_STEP_RAD) {
          this.jog.accum -= DAY_STEP_RAD;
          const d = this.windOneDay(this.jog.rollPosition, 1, this.jog.seg);
          if (d) {
            this.renderer.activeJog.toastText = `卷出 · ${d.date.getMonth() + 1}/${d.date.getDate()} 周${WEEKDAY_LABELS[d.wd]}`;
          }
        }
        while (this.jog.accum <= -DAY_STEP_RAD) {
          this.jog.accum += DAY_STEP_RAD;
          const d = this.windOneDay(this.jog.rollPosition, -1, this.jog.seg);
          if (d) {
            this.renderer.activeJog.toastText = `卷回 · ${d.date.getMonth() + 1}/${d.date.getDate()} 周${WEEKDAY_LABELS[d.wd]}`;
          }
        }
        this.renderer.draw();
        return;
      }

      // Single-finger height stretch handle
      if (this.handleDrag) {
        const dy = p.y - this.handleDrag.startY;
        if (Math.abs(dy) > 3) this.moved = true;
        const d = this.store.days[this.handleDrag.dayIdx];
        const nextW = Math.max(0.22, Math.min(12.5, this.handleDrag.startW + dy / Math.max(36, this.handleDrag.baseH)));
        d.w = nextW;
        d.tw = nextW;
        this.renderer.draw();
        return;
      }

      // Fog drag across days
      if (this.fogDrag) {
        const dist = Math.hypot(p.x - this.fogDrag.startX, p.y - this.fogDrag.startY);
        if (dist > 8) {
          this.fogDrag.active = true;
          this.moved = true;
        }
        if (this.fogDrag.active) {
          const seg = this.renderer.segAtScreenY(p.y);
          const hoverDayIdx = seg && !seg.roll ? seg.i : null;
          this.renderer.draggingFog = {
            item: this.fogDrag.item,
            screenY: p.y,
            hoverDayIdx,
          };
          this.renderer.draw();
        }
        return;
      }

      // Vertical scroll drag
      if (this.drag) {
        const dy = p.y - this.drag.startY;
        if (Math.abs(dy) > 5) {
          this.moved = true;
          this._clearLongPress();
        }
        const now = performance.now();
        const targetOff = this.drag.startOff - dy;
        this.drag.vel = (targetOff - this.renderer.scrollOffset) / Math.max(1, now - this.drag.lastT);
        this.drag.lastT = now;
        this.renderer.scrollOffset = targetOff;
        this.renderer.clampScroll();
        this.renderer.draw();
      }
    });

    const handlePointerEnd = (e) => {
      const p = this.pointers.get(e.pointerId) || this._localPoint(e);
      this.pointers.delete(e.pointerId);
      this._clearLongPress();

      // Pinch release -> snap compressed days (w < 0.30) into cylinders!
      if (this.pinch && this.pointers.size < 2) {
        this.pinch = null;
        const snapped = snapCompressedDaysToRolls(this.store.days, this.store.nowIdx);
        if (snapped > 0) foley.rollSnap(this.store.state.soundEnabled);
        this.store.persist();
        this.kickAnimation();
        this.drag = null;
        return;
      }

      // Jog dial release
      if (this.jog) {
        const wasMoved = this.moved;
        const seg = this.jog.seg;
        this.jog = null;
        this.renderer.activeJog = null;
        if (!wasMoved) {
          // Simple tap on end-face opens Roll menu or unrolls 1 day cleanly
          this.callbacks.onOpenRollMenu && this.callbacks.onOpenRollMenu(seg);
        }
        this.renderer.draw();
        this.callbacks.onMutated && this.callbacks.onMutated();
        return;
      }

      // Handle stretch release
      if (this.handleDrag) {
        this.handleDrag = null;
        this.renderer.activeHandleDayIdx = null;
        snapCompressedDaysToRolls(this.store.days, this.store.nowIdx);
        this.store.persist();
        this.kickAnimation();
        return;
      }

      // Fog drag release
      if (this.fogDrag) {
        const { item, active } = this.fogDrag;
        const dropInfo = this.renderer.draggingFog;
        this.fogDrag = null;
        this.renderer.draggingFog = null;
        if (!active) {
          // Simple tap on fog -> open Thing Panel!
          this.callbacks.onSelectItem && this.callbacks.onSelectItem(item.id);
        } else if (dropInfo && dropInfo.hoverDayIdx != null) {
          const targetDay = this.store.days[dropInfo.hoverDayIdx];
          this.callbacks.onDropFogOnDay && this.callbacks.onDropFogOnDay(item.id, targetDay);
        }
        this.renderer.draw();
        return;
      }

      // Tap or Scroll momentum release
      if (this.drag) {
        const drag = this.drag;
        this.drag = null;

        if (!this.moved) {
          // Handle Tap / Double-Tap
          if (drag.hitRoll) {
            this.unrollSegment(drag.hitRoll, 7);
            return;
          }

          const hit = this._hitTest(p.x, p.y) || drag.hitAtDown;
          if (hit) {
            if (hit.kind === 'return_wall') {
              this.callbacks.onOpenReturnWall && this.callbacks.onOpenReturnWall(hit.itemId);
              return;
            }
            if (hit.kind === 'item') {
              this.callbacks.onSelectItem && this.callbacks.onSelectItem(hit.itemId);
              return;
            }
            if (hit.kind === 'fog_cluster') {
              this.callbacks.onOpenFogCluster && this.callbacks.onOpenFogCluster(hit.items);
              return;
            }
            if (hit.kind === 'day_expand_more') {
              this.expandDayToMode(hit.dayIdx, 'full_list');
              return;
            }
            if (hit.kind === 'day_expand') {
              const nowMs = performance.now();
              if (nowMs - this.lastTapMs < 320 && this.lastTapDayIdx === hit.dayIdx) {
                this.expandDayToMode(hit.dayIdx, 'hour');
                this.lastTapMs = 0;
              } else {
                this.lastTapMs = nowMs;
                this.lastTapDayIdx = hit.dayIdx;
                this.expandDayToMode(hit.dayIdx, 'list');
              }
              return;
            }
          }

          // Double-tap on already expanded day toggles Hour-Scale <-> normal
          const seg = this.renderer.segAtScreenY(p.y);
          if (seg && !seg.roll) {
            const nowMs = performance.now();
            if (nowMs - this.lastTapMs < 320 && this.lastTapDayIdx === seg.i) {
              const d = this.store.days[seg.i];
              this.store.pushUndo('切换时刻读法');
              if (seg.mode === 3) {
                d.tw = 1;
                this.kickAnimation();
              } else {
                this.expandDayToMode(seg.i, 'hour');
              }
              this.lastTapMs = 0;
            } else {
              this.lastTapMs = nowMs;
              this.lastTapDayIdx = seg.i;
              // Tapping empty space clears selection (releases Yield mode)
              if (this.renderer.selectedItemId) {
                this.callbacks.onSelectItem && this.callbacks.onSelectItem(null);
              }
            }
          }
        } else if (Math.abs(drag.vel) > 0.25 && !this.isReducedMotion()) {
          // Smooth inertial glide
          let v = Math.max(-42, Math.min(42, drag.vel * 16));
          const glide = () => {
            this.renderer.scrollOffset += v;
            v *= 0.92;
            this.renderer.clampScroll();
            this.renderer.draw();
            if (Math.abs(v) > 0.45) {
              this.glideFrame = requestAnimationFrame(glide);
            } else {
              this.glideFrame = 0;
            }
          };
          this.glideFrame = requestAnimationFrame(glide);
        }
      }
    };

    cv.addEventListener('pointerup', handlePointerEnd);
    cv.addEventListener('pointercancel', handlePointerEnd);

    // Desktop Ctrl+Wheel (or trackpad pinch) & regular wheel scroll
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.callbacks.onFirstTouch && this.callbacks.onFirstTouch();
      const p = this._localPoint(e);
      if (e.ctrlKey || e.metaKey) {
        const fi = this.renderer.fractionalDayIndexAt(p.y);
        if (fi == null) return;
        const factor = Math.exp(-e.deltaY * 0.011);
        applyGaussianStretch(this.store.days, fi, factor);
        this.renderer.anchorFractionalDay(fi, p.y);
        this.renderer.draw();
        clearTimeout(this.wheelSnapTimer);
        this.wheelSnapTimer = setTimeout(() => {
          const snapped = snapCompressedDaysToRolls(this.store.days, this.store.nowIdx);
          if (snapped > 0) foley.rollSnap(this.store.state.soundEnabled);
          this.store.persist();
          this.kickAnimation();
        }, 260);
      } else {
        this.renderer.scrollOffset += e.deltaY;
        this.renderer.clampScroll();
        this.renderer.draw();
      }
    }, { passive: false });
  }
}
