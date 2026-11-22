// HAIZ · 自由共游 — what the hands say while riding: keys, a left thumb stick, right-hand drag to look, and a
// few held buttons on phones (each mode shows its own). The walk keeps its own controller
// (lanren/life/player.js); this one listens only while something is being ridden.
export function createInput({ dom, stickEl, padEl }) {
  const keys = new Set();
  const pressed = new Set();           // edges since the last read
  const stick = { x: 0, y: 0, id: null, ox: 0, oy: 0 };
  const look = { id: null, x: 0, y: 0, dx: 0, dy: 0 };
  const held = new Set();               // on-screen buttons held down
  let active = false, drag = null, zoom = 1, lastInput = 0;
  const now = () => performance.now() / 1000;

  addEventListener('keydown', (e) => {
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (!keys.has(e.code)) pressed.add(e.code);
    keys.add(e.code); lastInput = now();
    if (active && (e.code === 'Space' || /Arrow/.test(e.code))) e.preventDefault();
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => { keys.clear(); held.clear(); });

  const capture = (id) => { try { dom.setPointerCapture(id); } catch { /* synthetic pointer */ } };
  dom.addEventListener('pointerdown', (e) => {
    if (!active) return;
    lastInput = now();
    if (e.pointerType === 'touch') {
      if (e.clientX < innerWidth * 0.42 && stick.id === null) { stick.id = e.pointerId; stick.ox = e.clientX; stick.oy = e.clientY; stick.x = stick.y = 0; showStick(true, e.clientX, e.clientY); }
      else if (look.id === null) { look.id = e.pointerId; look.x = e.clientX; look.y = e.clientY; }
      capture(e.pointerId);
      return;
    }
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    capture(e.pointerId);
  });
  dom.addEventListener('pointermove', (e) => {
    if (!active) return;
    if (e.pointerId === stick.id) {
      const R = 56;
      let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy;
      const L = Math.hypot(dx, dy);
      if (L > R) { dx *= R / L; dy *= R / L; }
      stick.x = dx / R; stick.y = -dy / R;
      if (stickEl) stickEl.firstElementChild.style.transform = `translate(${dx}px, ${dy}px)`;
      lastInput = now();
    } else if (e.pointerId === look.id) {
      look.dx += (e.clientX - look.x) * 1.3; look.dy += (e.clientY - look.y) * 1.3; look.x = e.clientX; look.y = e.clientY; lastInput = now();
    } else if (drag && drag.id === e.pointerId) {
      look.dx += e.clientX - drag.x; look.dy += e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; lastInput = now();
    }
  });
  const end = (e) => {
    if (e.pointerId === stick.id) { stick.id = null; stick.x = stick.y = 0; showStick(false); }
    if (e.pointerId === look.id) look.id = null;
    if (drag && drag.id === e.pointerId) drag = null;
  };
  dom.addEventListener('pointerup', end);
  dom.addEventListener('pointercancel', end);
  dom.addEventListener('wheel', (e) => { if (!active) return; e.preventDefault(); zoom = Math.min(1.8, Math.max(0.55, zoom * Math.exp(e.deltaY * 0.0012))); }, { passive: false });
  function showStick(on, x, y) { if (!stickEl) return; stickEl.hidden = !on; if (on) { stickEl.style.left = x + 'px'; stickEl.style.top = y + 'px'; stickEl.firstElementChild.style.transform = ''; } }

  // on-screen buttons: <button data-pad="up"> … held while pressed
  if (padEl) {
    const down = (e) => { const b = e.target.closest('[data-pad]'); if (!b) return; e.preventDefault(); const k = b.dataset.pad; if (!held.has(k)) pressed.add('pad:' + k); held.add(k); b.classList.add('on'); lastInput = now(); try { b.setPointerCapture(e.pointerId); } catch { /* */ } };
    const up = (e) => { const b = e.target.closest('[data-pad]'); if (!b) return; held.delete(b.dataset.pad); b.classList.remove('on'); };
    padEl.addEventListener('pointerdown', down);
    padEl.addEventListener('pointerup', up); padEl.addEventListener('pointercancel', up); padEl.addEventListener('pointerleave', up);
  }

  const k = (...c) => c.some((x) => keys.has(x));
  return {
    get active() { return active; },
    setActive(v) { active = v; pressed.clear(); if (!v) { stick.id = null; stick.x = stick.y = 0; showStick(false); look.id = null; drag = null; held.clear(); padEl?.querySelectorAll('.on').forEach((b) => b.classList.remove('on')); } },
    keys, held,
    /** one frame of intent */
    read() {
      let ax = 0, ay = 0;
      if (k('KeyA', 'ArrowLeft')) ax -= 1;
      if (k('KeyD', 'ArrowRight')) ax += 1;
      if (k('KeyW', 'ArrowUp')) ay += 1;
      if (k('KeyS', 'ArrowDown')) ay -= 1;
      ax += stick.x; ay += stick.y;
      const touchRim = Math.hypot(stick.x, stick.y) > 0.92;
      const out = {
        ax: Math.max(-1, Math.min(1, ax)), ay: Math.max(-1, Math.min(1, ay)),
        boost: k('ShiftLeft', 'ShiftRight') || held.has('boost') || (touchRim && stick.y > 0.6),
        up: k('Space') || held.has('up'), down: k('KeyC', 'ControlLeft', 'ControlRight', 'KeyQ') || held.has('down'),
        brake: k('KeyS', 'ArrowDown') || held.has('brake') || stick.y < -0.5,
        jump: pressed.has('Space') || pressed.has('pad:jump'),
        bell: pressed.has('Space') || pressed.has('pad:bell'),
        lookDX: look.dx, lookDY: look.dy, looking: !!drag || look.id !== null, zoom,
        touch: stick.id !== null, idle: now() - lastInput,
      };
      look.dx = look.dy = 0;
      pressed.clear();
      return out;
    },
    /** key edges for things that work whatever is ridden (mode keys); consumed by the caller */
    took(code) { if (pressed.has(code)) { pressed.delete(code); return true; } return false; },
    get lastInput() { return lastInput; },
  };
}
