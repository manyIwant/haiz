// HAIZ · 自由移动 — Adaptive Desktop & Mobile Input Controller
//
// Desktop: WASD/Arrows, Shift (boost/stand/manual), Space (bell/ollie/climb; double-tap to perch),
//          Q (kickflip/flourish), C/Control (descend/dive), mouse drag orbit, wheel zoom.
// Mobile:  Left-half invisible floating thumbstick (only manifests softly where your thumb touches),
//          right-half camera drag look, and ergonomic mode-contextual right-thumb action pills.
export function createInput({ dom, stickEl, padEl }) {
  const keys = new Set();
  const held = new Set();
  const pulses = { bell: false, jump: false, trick: false, perch: false };
  const look = { dx: 0, dy: 0, zoom: 1, dragging: false, idle: 9 };
  const stick = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0, edge: false };
  const drag = { active: false, id: null, x: 0, y: 0 };
  let active = false;
  let lastSpace = 0;

  const isForm = (el) => el && /INPUT|TEXTAREA|SELECT/.test(el.tagName);

  addEventListener('keydown', (e) => {
    if (!active || isForm(e.target)) return;
    const first = !keys.has(e.code);
    keys.add(e.code);
    if (first && e.code === 'Space') {
      const now = performance.now();
      if (now - lastSpace < 320) pulses.perch = true;
      lastSpace = now;
      pulses.bell = true;
      pulses.jump = true;
    }
    if (first && e.code === 'KeyQ') pulses.trick = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  });
  addEventListener('keyup', (e) => { keys.delete(e.code); });
  addEventListener('blur', () => { keys.clear(); held.clear(); stick.active = false; drag.active = false; hideStick(); });

  const knob = stickEl?.querySelector('i');
  const R = 48;
  function showStick(x, y) {
    if (!stickEl) return;
    stickEl.hidden = false;
    stickEl.style.left = x + 'px';
    stickEl.style.top = y + 'px';
    if (knob) knob.style.transform = 'translate(-50%,-50%)';
  }
  function moveStick(dx, dy) {
    if (!knob) return;
    knob.style.transform = `translate(calc(-50% + ${dx.toFixed(1)}px), calc(-50% + ${dy.toFixed(1)}px))`;
  }
  function hideStick() {
    if (stickEl) stickEl.hidden = true;
    stick.x = stick.y = 0; stick.edge = false;
  }

  dom.addEventListener('pointerdown', (e) => {
    if (!active) return;
    if (e.pointerType === 'touch') {
      if (e.clientX < innerWidth * 0.5 && !stick.active) {
        stick.active = true; stick.id = e.pointerId; stick.ox = e.clientX; stick.oy = e.clientY;
        stick.x = stick.y = 0; stick.edge = false;
        showStick(e.clientX, e.clientY);
        dom.setPointerCapture?.(e.pointerId);
      } else if (!drag.active) {
        drag.active = true; drag.id = e.pointerId; drag.x = e.clientX; drag.y = e.clientY;
        look.dragging = true;
        dom.setPointerCapture?.(e.pointerId);
      }
    } else if (e.button === 0 || e.button === 2) {
      drag.active = true; drag.id = e.pointerId; drag.x = e.clientX; drag.y = e.clientY;
      look.dragging = true;
      dom.setPointerCapture?.(e.pointerId);
    }
  });

  dom.addEventListener('pointermove', (e) => {
    if (!active) return;
    if (stick.active && e.pointerId === stick.id) {
      let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx = dx / d * R; dy = dy / d * R; }
      stick.x = dx / R; stick.y = -dy / R;
      stick.edge = d > R * 0.9;
      moveStick(dx, dy);
    } else if (drag.active && e.pointerId === drag.id) {
      look.dx += e.clientX - drag.x;
      look.dy += e.clientY - drag.y;
      drag.x = e.clientX; drag.y = e.clientY;
      look.idle = 0;
    }
  });

  const endPtr = (e) => {
    if (stick.active && e.pointerId === stick.id) { stick.active = false; stick.id = null; hideStick(); }
    if (drag.active && e.pointerId === drag.id) { drag.active = false; drag.id = null; look.dragging = false; }
  };
  dom.addEventListener('pointerup', endPtr);
  dom.addEventListener('pointercancel', endPtr);
  dom.addEventListener('wheel', (e) => {
    if (!active) return;
    look.zoom = Math.max(0.65, Math.min(1.65, look.zoom + Math.sign(e.deltaY) * 0.08));
  }, { passive: true });

  // Right-thumb action buttons on touch devices
  if (padEl) {
    const down = (e) => {
      const b = e.target.closest('[data-pad]');
      if (!b || !active) return;
      e.preventDefault(); e.stopPropagation();
      const k = b.dataset.pad;
      b.classList.add('on');
      held.add(k);
      if (k === 'bell') pulses.bell = true;
      if (k === 'jump') pulses.jump = true;
      if (k === 'trick') pulses.trick = true;
      if (k === 'perch') pulses.perch = true;
      b.setPointerCapture?.(e.pointerId);
    };
    const up = (e) => {
      const b = e.target.closest('[data-pad]');
      if (!b) return;
      b.classList.remove('on');
      held.delete(b.dataset.pad);
    };
    padEl.addEventListener('pointerdown', down);
    padEl.addEventListener('pointerup', up);
    padEl.addEventListener('pointercancel', up);
  }

  // Test hook for deterministic synthetic key/stick input
  const synthetic = { on: false, ax: 0, ay: 0, boost: false, up: false, down: false, brake: false };

  return {
    setActive(v) {
      active = v;
      if (!v) { keys.clear(); held.clear(); stick.active = false; drag.active = false; look.dragging = false; hideStick(); }
    },
    setSynthetic(patch) {
      if (!patch) { synthetic.on = false; return; }
      synthetic.on = true;
      Object.assign(synthetic, patch);
      if (patch.bell) pulses.bell = true;
      if (patch.jump) pulses.jump = true;
      if (patch.trick) pulses.trick = true;
      if (patch.perch) pulses.perch = true;
    },
    read(dt = 1 / 60) {
      let ax = 0, ay = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) ax -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) ax += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) ay += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) ay -= 1;
      if (stick.active) { ax = stick.x; ay = stick.y; }
      let boost = keys.has('ShiftLeft') || keys.has('ShiftRight') || held.has('boost') || (stick.active && stick.edge && stick.y > 0.45);
      let up = keys.has('Space') || held.has('up');
      let down = keys.has('KeyC') || keys.has('ControlLeft') || keys.has('ControlRight') || held.has('down');
      let brake = keys.has('KeyS') || keys.has('ArrowDown') || (stick.active && stick.y < -0.35);

      if (synthetic.on) {
        ax = synthetic.ax ?? 0; ay = synthetic.ay ?? 0;
        boost = !!synthetic.boost; up = !!synthetic.up; down = !!synthetic.down; brake = !!synthetic.brake;
      }

      const out = {
        ax, ay, boost, up, down, brake,
        bell: pulses.bell, jump: pulses.jump, trick: pulses.trick, perch: pulses.perch,
        lookDX: look.dx, lookDY: look.dy, looking: look.dragging, idle: look.idle, zoom: look.zoom,
      };
      pulses.bell = pulses.jump = pulses.trick = pulses.perch = false;
      look.dx = look.dy = 0;
      if (!look.dragging) look.idle += dt;
      return out;
    },
  };
}
