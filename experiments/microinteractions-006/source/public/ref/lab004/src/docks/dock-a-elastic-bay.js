/**
 * HAIZ Experiment 004 · System A: 「弹性空间让位 · 建筑排席」 (Elastic Bay / Spatial Yielding)
 *
 * Spatial Architecture:
 *   - Rest state: ultra-quiet compact capsule of 5 pure 52px sculptural icon bays (zero label clutter).
 *   - Hover focus: hovered bay boldly claims 164px (+112px!), smoothly revealing title + architectural
 *     subtitle inside the expanding bay, while adjacent neighbors compress (52px -> 39px) and lean
 *     gracefully outward away from the focus (spatial yielding!).
 *   - Whole vessel participation: outer capsule width (+76px), height (+6px), and horizontal center-of-mass
 *     inertia (`vesselX`) breathe as ONE coupled physical instrument.
 *   - Kinetic transfer: sweeping across slots injects traveling compression velocity through intermediate bays.
 *   - Zero flicker: hit-testing evaluates continuously against normalized vessel X (Hairline Rule 01!).
 */

import { DOCK_ITEMS } from "../data/dock-items.js";
import { mountSculpturalIconV4 } from "../engine/sculptural-icons-v4.js";
import { makeSpring, stepSpring, createVelocityTracker, clamp, smoothstep } from "../engine/clock-physics.js";

const REST_W = 52;
const FOCUS_W = 164;
const ADJ_W = 39;
const FAR_W = 45;
const REST_H = 54;
const HOVER_H = 60;
const PAD_X = 8;

export function mountDockElasticBay({ host, clock, onSelect, onMirrorHover, onMirrorLeave }) {
  host.innerHTML = `
    <div class="da-stage" data-stage>
      <div class="da-vessel" data-vessel>
        <div class="da-focus-plate" data-plate aria-hidden="true"></div>
        <div class="da-track" data-track></div>
      </div>
    </div>
  `;

  const stage = host.querySelector("[data-stage]");
  const vessel = host.querySelector("[data-vessel]");
  const plate = host.querySelector("[data-plate]");
  const track = host.querySelector("[data-track]");

  let cachedAvailW = Math.max(280, (host.clientWidth || window.innerWidth) - 20);
  const ro = new ResizeObserver((entries) => {
    const w = entries[0]?.contentRect?.width;
    if (w) cachedAvailW = Math.max(280, w - 20);
  });
  ro.observe(host);

  const vel = createVelocityTracker();
  let hoveredIdx = -1;
  let pressedIdx = -1;
  let activeId = DOCK_ITEMS[0].id;
  let activeIdx = 0;

  // Coupled spring state for every bay + vessel geometry
  const bayW = DOCK_ITEMS.map(() => makeSpring(REST_W, { k: 245, c: 23.5, eps: 0.08 }));
  const vesselH = makeSpring(REST_H, { k: 230, c: 23, eps: 0.05 });
  const vesselShift = makeSpring(0, { k: 170, c: 17.5, eps: 0.05 });
  const plateX = makeSpring(PAD_X, { k: 290, c: 27, eps: 0.08 });
  const plateW = makeSpring(REST_W, { k: 290, c: 27, eps: 0.08 });
  const plateOp = makeSpring(0, { k: 260, c: 26, eps: 0.005 });

  const slots = [];
  const icons = [];

  DOCK_ITEMS.forEach((item, idx) => {
    const slot = document.createElement("button");
    slot.className = `da-slot ${idx === activeIdx ? "is-active" : ""}`;
    slot.dataset.id = item.id;
    slot.setAttribute("aria-label", `${item.fullTitle} · ${item.sub}`);
    slot.innerHTML = `
      <span class="da-ic-wrap"></span>
      <span class="da-copy" aria-hidden="true">
        <strong class="da-t">${item.title}</strong>
        <span class="da-s">${item.sub}</span>
      </span>
      <span class="da-active-bar" aria-hidden="true"></span>
    `;
    track.appendChild(slot);
    slots.push({
      el: slot,
      icWrap: slot.querySelector(".da-ic-wrap"),
      copy: slot.querySelector(".da-copy"),
      bar: slot.querySelector(".da-active-bar"),
    });
    const ic = mountSculpturalIconV4(slot.querySelector(".da-ic-wrap"), item.id, clock, { size: 25 });
    ic.setActive(idx === activeIdx);
    icons.push(ic);
  });

  function updateTargets(prevIdx, nextIdx, vx = 0) {
    hoveredIdx = nextIdx;
    const isHov = nextIdx >= 0;
    const isPress = pressedIdx >= 0;

    vesselH.t = isPress ? REST_H - 1 : (isHov ? HOVER_H : REST_H);

    // Kinetic momentum transfer: sweeping across slots pushes vessel center-of-mass & intervening bays!
    if (isHov && prevIdx !== nextIdx) {
      const dir = prevIdx >= 0 ? Math.sign(nextIdx - prevIdx) : Math.sign(vx || 1);
      const jump = prevIdx >= 0 ? Math.abs(nextIdx - prevIdx) : 1;
      const spd = clamp(Math.abs(vx) || 0.9, 0.6, 2.5);
      vesselShift.v += dir * spd * (22 + jump * 9);

      // Inject traveling elastic ripple into bays crossed during multi-slot jump!
      if (prevIdx >= 0 && jump > 1) {
        const lo = Math.min(prevIdx, nextIdx);
        const hi = Math.max(prevIdx, nextIdx);
        for (let k = lo + 1; k < hi; k++) {
          bayW[k].v += 190 * spd;
          icons[k].injectImpulse(dir * spd * 0.95);
        }
      }
      // Transfer departure momentum into new focus bay & gentle recoil into departed bay
      bayW[nextIdx].v += 130 * spd;
      if (prevIdx >= 0) bayW[prevIdx].v -= 95 * spd;
    }

    DOCK_ITEMS.forEach((it, i) => {
      if (!isHov) {
        bayW[i].t = REST_W;
        icons[i].setHover(false, i === prevIdx ? vx : 0);
        icons[i].setLean(0);
      } else {
        const d = Math.abs(i - nextIdx);
        const baseW = d === 0 ? (pressedIdx === i ? FOCUS_W - 12 : FOCUS_W) : d === 1 ? ADJ_W : FAR_W;
        bayW[i].t = baseW;
        icons[i].setHover(d === 0, d === 0 ? vx : (i === prevIdx ? vx * 0.6 : 0));
        // Spatial yielding lean: neighbors visibly tilt outward away from focus!
        const leanVal = d === 0 ? clamp(vx * 0.16, -0.3, 0.3) : d === 1 ? Math.sign(i - nextIdx) * 0.72 : Math.sign(i - nextIdx) * 0.25;
        icons[i].setLean(leanVal);
      }
    });

    plateOp.t = isHov ? 1 : 0;
    clock.wake();
  }

  function setActive(id) {
    const idx = DOCK_ITEMS.findIndex((x) => x.id === id);
    if (idx < 0) return;
    activeId = id;
    activeIdx = idx;
    slots.forEach((s, i) => {
      const on = i === activeIdx;
      s.el.classList.toggle("is-active", on);
      icons[i].setActive(on);
    });
    // Celebratory micro-pulse on newly activated bay
    bayW[activeIdx].v += 120;
    clock.wake();
  }

  function hitIndexFromClientX(clientX) {
    const r = vessel.getBoundingClientRect();
    if (clientX < r.left - 14 || clientX > r.right + 14) return -1;
    // Hairline Rule 01: uniform normalized hit bands never fight expanding bay geometry!
    const u = clamp((clientX - r.left) / Math.max(1, r.width), 0, 0.999);
    return Math.floor(u * DOCK_ITEMS.length);
  }

  // Unified desktop + mobile touch-scrub pointer handling (zero double-tap!)
  let touchActive = false, touchStartX = 0, touchMoved = false;

  vessel.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch" && !touchActive) return;
    clock.markInput();
    const v = vel.sample(e.clientX, e.clientY);
    if (touchActive && Math.abs(e.clientX - touchStartX) > 10) touchMoved = true;
    const idx = hitIndexFromClientX(e.clientX);
    if (idx >= 0 && idx !== hoveredIdx) {
      updateTargets(hoveredIdx, idx, v.vx);
      onMirrorHover?.(idx, v.vx);
    }
  });

  vessel.addEventListener("pointerleave", (e) => {
    if (e.pointerType === "touch") return;
    vel.reset();
    pressedIdx = -1;
    icons.forEach((ic) => ic.setPress(false));
    updateTargets(hoveredIdx, -1, 0);
    onMirrorLeave?.();
  });

  vessel.addEventListener("pointerdown", (e) => {
    clock.markInput();
    const idx = hitIndexFromClientX(e.clientX);
    if (idx < 0) return;
    if (e.pointerType === "touch") {
      touchActive = true;
      touchStartX = e.clientX;
      touchMoved = false;
      vessel.setPointerCapture?.(e.pointerId);
    }
    pressedIdx = idx;
    icons[idx].setPress(true);
    updateTargets(hoveredIdx, idx, 0);
  });

  const handleUp = (e) => {
    if (pressedIdx < 0 && !touchActive) return;
    const targetIdx = hoveredIdx >= 0 ? hoveredIdx : pressedIdx;
    if (pressedIdx >= 0) icons[pressedIdx].setPress(false);
    pressedIdx = -1;
    if (targetIdx >= 0) {
      setActive(DOCK_ITEMS[targetIdx].id);
      onSelect?.(DOCK_ITEMS[targetIdx], "system-a");
    }
    if (e.pointerType === "touch") {
      touchActive = false;
      updateTargets(hoveredIdx, -1, 0);
    } else {
      updateTargets(hoveredIdx, hoveredIdx, 0);
    }
  };
  vessel.addEventListener("pointerup", handleUp);
  vessel.addEventListener("pointercancel", () => {
    touchActive = false;
    if (pressedIdx >= 0) icons[pressedIdx].setPress(false);
    pressedIdx = -1;
    updateTargets(hoveredIdx, -1, 0);
  });

  function renderFrame(dt) {
    let moving = false;
    let totalW = PAD_X * 2;
    for (let i = 0; i < bayW.length; i++) {
      if (dt > 0 && stepSpring(bayW[i], dt)) moving = true;
      totalW += bayW[i].x;
    }
    if (dt > 0 && stepSpring(vesselH, dt)) moving = true;
    if (dt > 0 && stepSpring(vesselShift, dt)) moving = true;
    if (dt > 0 && stepSpring(plateOp, dt)) moving = true;

    // Position slots & derive exact focus plate geometry
    let cursor = PAD_X;
    for (let i = 0; i < slots.length; i++) {
      const w = bayW[i].x;
      const s = slots[i];
      s.el.style.width = `${w.toFixed(2)}px`;
      s.el.style.transform = `translate3d(${cursor.toFixed(2)}px, 0, 0)`;

      // Smoothly unfurl copy directly coupled to physical bay expansion width!
      const reveal = smoothstep(REST_W + 14, FOCUS_W - 22, w);
      s.copy.style.opacity = reveal.toFixed(3);
      s.copy.style.transform = `translate3d(${((1 - reveal) * -10).toFixed(1)}px, 0, 0)`;
      // Icon shifts gracefully from centered (at rest) to left-aligned (with generous 12px breathing room before copy)
      const icShift = reveal * -((w - REST_W) * 0.47);
      s.icWrap.style.transform = `translate3d(${icShift.toFixed(1)}px, 0, 0)`;

      if (i === hoveredIdx) {
        plateX.t = cursor;
        plateW.t = w;
        if (plateOp.x < 0.04) { plateX.x = cursor; plateW.x = w; }
      }
      cursor += w;
    }

    if (dt > 0 && stepSpring(plateX, dt)) moving = true;
    if (dt > 0 && stepSpring(plateW, dt)) moving = true;

    // Clamp total width smoothly on narrow mobile viewports (zero layout read in RAF!)
    const fitScale = totalW > cachedAvailW ? cachedAvailW / totalW : 1;

    vessel.style.width = `${totalW.toFixed(1)}px`;
    vessel.style.height = `${vesselH.x.toFixed(1)}px`;
    vessel.style.transform = `translate3d(${vesselShift.x.toFixed(2)}px, 0, 0) scale(${fitScale.toFixed(4)})`;

    plate.style.opacity = clamp(plateOp.x, 0, 1).toFixed(3);
    plate.style.width = `${Math.max(36, plateW.x).toFixed(1)}px`;
    plate.style.transform = `translate3d(${plateX.x.toFixed(1)}px, 0, 0)`;

    return moving;
  }

  const unsub = clock.subscribe((dt) => renderFrame(dt));
  renderFrame(0);

  return {
    setVirtualHover(idx, vx = 1.0) {
      updateTargets(hoveredIdx, idx, vx);
    },
    setVirtualPress(idx, down) {
      pressedIdx = down ? idx : -1;
      if (idx >= 0) icons[idx].setPress(down);
      updateTargets(hoveredIdx, idx, 0);
    },
    setActive,
    getTelemetry() {
      const curW = bayW.reduce((a, b) => a + b.x, PAD_X * 2);
      const restTotal = REST_W * DOCK_ITEMS.length + PAD_X * 2;
      return {
        id: "system-a",
        widthDelta: +(curW - restTotal).toFixed(1),
        heightDelta: +(vesselH.x - REST_H).toFixed(1),
        hoveredIdx,
        activeId,
        slotWidths: bayW.map((b) => Math.round(b.x)),
      };
    },
    destroy() {
      ro.disconnect();
      unsub();
      icons.forEach((ic) => ic.destroy());
    },
  };
}
