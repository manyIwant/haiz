/**
 * HAIZ Experiment 004 · System B: 「连续液态几何 · 单一轮廓膜」 (Continuous SVG Bézier Membrane)
 *
 * Spatial Architecture:
 *   - ZERO rectangular CSS box border! The ENTIRE dock outline is ONE live procedural SVG Cubic-Bézier
 *     contour rendered dynamically from spring physics every frame.
 *   - When hovered, the upper boundary of the vessel ITSELF swells upward into a tangent-continuous
 *     organic canopy fused directly to the dock via smooth concave neck fillets — carrying the module
 *     title + micro-status inside the SAME unbroken geometric membrane (no detached popup!).
 *   - Inside the membrane, a shared liquid focus capsule glides between entries with true volume-preserving
 *     velocity stretch (`stretchX` proportional to |vx|, `squishY` thinning at waist) so motion from A
 *     visibly stretches and pours into B!
 *   - Icons inside gently part (±9px) around the elevated focused icon (-8px) so negative space opens cleanly.
 */

import { DOCK_ITEMS } from "../data/dock-items.js";
import { mountSculpturalIconV4 } from "../engine/sculptural-icons-v4.js";
import { makeSpring, stepSpring, createVelocityTracker, clamp } from "../engine/clock-physics.js";

const SLOT_STEP = 58;
const BASE_W = 316;
const BASE_H = 54;
const SVG_W = 420;
const SVG_H = 148;
const BASE_Y = 82; // top of resting capsule inside SVG coordinate system
const X0 = (SVG_W - BASE_W) / 2;
const X1 = X0 + BASE_W;

/**
 * Generates ONE continuous, tangent-smooth SVG closed contour path combining:
 *   - Lower rounded capsule [X0..X1, BASE_Y..BASE_Y+BASE_H]
 *   - Seamless upper canopy swelling directly out of `cx` with height `canopyH` & half-width `canopyHW`
 *     connected by silky concave cubic-Bézier tangent fillets!
 */
function buildUnifiedMembranePath(cx, canopyH, canopyHW, breatheX) {
  const lx = X0 - breatheX;
  const rx = X1 + breatheX;
  const topY = BASE_Y;
  const botY = BASE_Y + BASE_H;
  const R = BASE_H / 2;

  if (canopyH < 0.8) {
    // Pure quiet resting capsule!
    return [
      `M ${(lx + R).toFixed(2)} ${topY.toFixed(2)}`,
      `H ${(rx - R).toFixed(2)}`,
      `A ${R} ${R} 0 0 1 ${(rx - R).toFixed(2)} ${botY.toFixed(2)}`,
      `H ${(lx + R).toFixed(2)}`,
      `A ${R} ${R} 0 0 1 ${(lx + R).toFixed(2)} ${topY.toFixed(2)}`,
      `Z`,
    ].join(" ");
  }

  // Clamp canopy cleanly so BOTH concave tangent fillets remain silky even on edge slots 0 & 4!
  const fillet = Math.min(26, 12 + canopyH * 0.28);
  const hw = canopyHW;
  const edgeMargin = R + hw + fillet * 0.82;
  const cClamped = clamp(cx, lx + edgeMargin, rx - edgeMargin);
  const roofY = topY - canopyH;
  const cR = Math.min(18, canopyH * 0.45);

  const footL = Math.max(lx + R + 1, cClamped - hw - fillet);
  const footR = Math.min(rx - R - 1, cClamped + hw + fillet);
  const wallL = cClamped - hw;
  const wallR = cClamped + hw;

  return [
    `M ${(lx + R).toFixed(2)} ${topY.toFixed(2)}`,
    `L ${footL.toFixed(2)} ${topY.toFixed(2)}`,
    // Left concave tangent fillet rising into canopy roof
    `C ${(footL + fillet * 0.72).toFixed(2)} ${topY.toFixed(2)}, ${wallL.toFixed(2)} ${(topY - canopyH * 0.08).toFixed(2)}, ${wallL.toFixed(2)} ${(roofY + cR).toFixed(2)}`,
    `Q ${wallL.toFixed(2)} ${roofY.toFixed(2)}, ${(wallL + cR).toFixed(2)} ${roofY.toFixed(2)}`,
    `L ${(wallR - cR).toFixed(2)} ${roofY.toFixed(2)}`,
    `Q ${wallR.toFixed(2)} ${roofY.toFixed(2)}, ${wallR.toFixed(2)} ${(roofY + cR).toFixed(2)}`,
    // Right concave tangent fillet flowing back into capsule rim
    `C ${wallR.toFixed(2)} ${(topY - canopyH * 0.08).toFixed(2)}, ${(footR - fillet * 0.72).toFixed(2)} ${topY.toFixed(2)}, ${footR.toFixed(2)} ${topY.toFixed(2)}`,
    `L ${(rx - R).toFixed(2)} ${topY.toFixed(2)}`,
    `A ${R} ${R} 0 0 1 ${(rx - R).toFixed(2)} ${botY.toFixed(2)}`,
    `L ${(lx + R).toFixed(2)} ${botY.toFixed(2)}`,
    `A ${R} ${R} 0 0 1 ${(lx + R).toFixed(2)} ${topY.toFixed(2)}`,
    `Z`,
  ].join(" ");
}

export function mountDockLiquidMembrane({ host, clock, onSelect, onMirrorHover, onMirrorLeave }) {
  host.innerHTML = `
    <div class="db-stage" data-stage>
      <div class="db-wrap" data-wrap>
        <svg class="db-svg" viewBox="0 0 ${SVG_W} ${SVG_H}" width="${SVG_W}" height="${SVG_H}" aria-hidden="true">
          <path class="db-membrane" data-membrane></path>
          <rect class="db-liquid-pill" data-pill rx="20" ry="20"></rect>
          <circle class="db-index-dot" data-idot r="2.2"></circle>
        </svg>

        <div class="db-canopy-label" data-canopy-label aria-hidden="true">
          <strong class="db-cl-t" data-cl-t></strong>
          <span class="db-cl-s" data-cl-s></span>
        </div>

        <div class="db-items" data-items></div>
      </div>
    </div>
  `;

  const wrap = host.querySelector("[data-wrap]");
  const membrane = host.querySelector("[data-membrane]");
  const pill = host.querySelector("[data-pill]");
  const idot = host.querySelector("[data-idot]");
  const canopyLbl = host.querySelector("[data-canopy-label]");
  const clT = host.querySelector("[data-cl-t]");
  const clS = host.querySelector("[data-cl-s]");
  const itemsEl = host.querySelector("[data-items]");

  let cachedAvailW = Math.max(300, (host.clientWidth || window.innerWidth) - 12);
  const ro = new ResizeObserver((entries) => {
    const w = entries[0]?.contentRect?.width;
    if (w) cachedAvailW = Math.max(300, w - 12);
  });
  ro.observe(host);

  const vel = createVelocityTracker();
  let hoveredIdx = -1;
  let pressedIdx = -1;
  let activeIdx = 0;
  let activeId = DOCK_ITEMS[0].id;

  const restCenterX = (i) => SVG_W / 2 + (i - (DOCK_ITEMS.length - 1) / 2) * SLOT_STEP;

  // Continuous membrane & liquid pill physics
  const focusX = makeSpring(restCenterX(0), { k: 220, c: 21, eps: 0.08 });
  const canopyH = makeSpring(0, { k: 225, c: 22, eps: 0.08 });
  const canopyHW = makeSpring(44, { k: 215, c: 22, eps: 0.08 });
  const breatheX = makeSpring(0, { k: 200, c: 20, eps: 0.05 });
  const pillOp = makeSpring(0, { k: 250, c: 24, eps: 0.005 });
  const dotX = makeSpring(restCenterX(0), { k: 260, c: 24, eps: 0.08 });

  const slotShift = DOCK_ITEMS.map(() => makeSpring(0, { k: 230, c: 22, eps: 0.05 }));
  const slotLift  = DOCK_ITEMS.map(() => makeSpring(0, { k: 250, c: 22, eps: 0.05 }));
  const btns = [];
  const icons = [];

  DOCK_ITEMS.forEach((item, i) => {
    const b = document.createElement("button");
    b.className = `db-btn ${i === activeIdx ? "is-active" : ""}`;
    b.dataset.id = item.id;
    b.setAttribute("aria-label", `${item.fullTitle} · ${item.sub}`);
    b.innerHTML = `<span class="db-ic"></span>`;
    itemsEl.appendChild(b);
    btns.push(b);

    const ic = mountSculpturalIconV4(b.querySelector(".db-ic"), item.id, clock, { size: 25 });
    ic.setActive(i === activeIdx);
    icons.push(ic);
  });

  function updateHover(prevIdx, nextIdx, vx = 0) {
    hoveredIdx = nextIdx;
    const on = nextIdx >= 0;

    if (on) {
      const targetX = restCenterX(nextIdx);
      if (prevIdx < 0) {
        focusX.x = targetX;
        focusX.v = clamp(vx * 85, -180, 180);
      }
      focusX.t = targetX;
      canopyH.t = pressedIdx === nextIdx ? 42 : 52;
      canopyHW.t = 76;
      breatheX.t = (nextIdx === 0 || nextIdx === DOCK_ITEMS.length - 1) ? 20 : 12;
      pillOp.t = 1;

      const meta = DOCK_ITEMS[nextIdx];
      clT.textContent = meta.fullTitle;
      clS.textContent = meta.sub;

      // Multi-slot jump injects liquid momentum into crossed icons!
      if (prevIdx >= 0 && Math.abs(nextIdx - prevIdx) > 1) {
        const dir = Math.sign(nextIdx - prevIdx);
        const lo = Math.min(prevIdx, nextIdx);
        const hi = Math.max(prevIdx, nextIdx);
        for (let k = lo + 1; k < hi; k++) icons[k].injectImpulse(dir * 1.4);
      }
    } else {
      canopyH.t = 0;
      canopyHW.t = 44;
      breatheX.t = 0;
      pillOp.t = 0;
    }

    DOCK_ITEMS.forEach((_, i) => {
      if (!on) {
        slotShift[i].t = 0;
        slotLift[i].t = 0;
        icons[i].setHover(false, i === prevIdx ? vx : 0);
        icons[i].setLean(0);
      } else {
        const d = i - nextIdx;
        const ad = Math.abs(d);
        // Neighbors gently part outward to give the elevated focus breathing room!
        slotShift[i].t = ad === 0 ? 0 : ad === 1 ? Math.sign(d) * 9 : Math.sign(d) * 4;
        slotLift[i].t = ad === 0 ? (pressedIdx === i ? -3 : -9.5) : ad === 1 ? -1.5 : 0;
        icons[i].setHover(ad === 0, ad === 0 ? vx : (i === prevIdx ? vx * 0.5 : 0));
        icons[i].setLean(ad === 0 ? 0 : Math.sign(d) * (ad === 1 ? 0.52 : 0.18));
      }
    });
    clock.wake();
  }

  function setActive(id) {
    const idx = DOCK_ITEMS.findIndex((x) => x.id === id);
    if (idx < 0) return;
    activeId = id;
    activeIdx = idx;
    dotX.t = restCenterX(idx);
    btns.forEach((b, i) => {
      b.classList.toggle("is-active", i === idx);
      icons[i].setActive(i === idx);
    });
    canopyH.v += 95;
    clock.wake();
  }

  function hitIndexFromClientX(clientX) {
    const r = wrap.getBoundingClientRect();
    const scaleX = SVG_W / Math.max(1, r.width);
    const sx = (clientX - r.left) * scaleX;
    if (sx < X0 - 16 || sx > X1 + 16) return -1;
    let best = 0, bestD = Infinity;
    for (let i = 0; i < DOCK_ITEMS.length; i++) {
      const d = Math.abs(sx - restCenterX(i));
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  let touchActive = false;
  wrap.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch" && !touchActive) return;
    clock.markInput();
    const v = vel.sample(e.clientX, e.clientY);
    const idx = hitIndexFromClientX(e.clientX);
    if (idx >= 0 && idx !== hoveredIdx) {
      updateHover(hoveredIdx, idx, v.vx);
      onMirrorHover?.(idx, v.vx);
    }
  });
  wrap.addEventListener("pointerleave", (e) => {
    if (e.pointerType === "touch") return;
    vel.reset();
    pressedIdx = -1;
    icons.forEach((ic) => ic.setPress(false));
    updateHover(hoveredIdx, -1, 0);
    onMirrorLeave?.();
  });
  wrap.addEventListener("pointerdown", (e) => {
    clock.markInput();
    const idx = hitIndexFromClientX(e.clientX);
    if (idx < 0) return;
    if (e.pointerType === "touch") {
      touchActive = true;
      wrap.setPointerCapture?.(e.pointerId);
    }
    pressedIdx = idx;
    icons[idx].setPress(true);
    updateHover(hoveredIdx, idx, 0);
  });
  const handleUp = (e) => {
    if (pressedIdx < 0 && !touchActive) return;
    const tIdx = hoveredIdx >= 0 ? hoveredIdx : pressedIdx;
    if (pressedIdx >= 0) icons[pressedIdx].setPress(false);
    pressedIdx = -1;
    if (tIdx >= 0) {
      setActive(DOCK_ITEMS[tIdx].id);
      onSelect?.(DOCK_ITEMS[tIdx], "system-b");
    }
    if (e.pointerType === "touch") {
      touchActive = false;
      updateHover(hoveredIdx, -1, 0);
    } else {
      updateHover(hoveredIdx, hoveredIdx, 0);
    }
  };
  wrap.addEventListener("pointerup", handleUp);
  wrap.addEventListener("pointercancel", () => {
    touchActive = false;
    if (pressedIdx >= 0) icons[pressedIdx].setPress(false);
    pressedIdx = -1;
    updateHover(hoveredIdx, -1, 0);
  });

  function renderFrame(dt) {
    let moving = false;
    if (dt > 0 && stepSpring(focusX, dt)) moving = true;
    if (dt > 0 && stepSpring(canopyH, dt)) moving = true;
    if (dt > 0 && stepSpring(canopyHW, dt)) moving = true;
    if (dt > 0 && stepSpring(breatheX, dt)) moving = true;
    if (dt > 0 && stepSpring(pillOp, dt)) moving = true;
    if (dt > 0 && stepSpring(dotX, dt)) moving = true;
    for (let i = 0; i < DOCK_ITEMS.length; i++) {
      if (dt > 0 && stepSpring(slotShift[i], dt)) moving = true;
      if (dt > 0 && stepSpring(slotLift[i], dt)) moving = true;
    }

    // 1. Rebuild single continuous outer Bézier membrane path!
    membrane.setAttribute("d", buildUnifiedMembranePath(focusX.x, canopyH.x, canopyHW.x, breatheX.x));

    // 2. Volume-preserving velocity-stretched liquid focus capsule inside membrane!
    const speedX = Math.abs(focusX.v) / 650;
    const stretchW = clamp(speedX * 56, 0, 62);
    const squishH = clamp(speedX * 8, 0, 8);
    const pw = 44 + stretchW;
    const ph = 42 - squishH;
    const py = BASE_Y + (BASE_H - ph) / 2 - (canopyH.x / 52) * 7.5;
    pill.setAttribute("x", (focusX.x - pw / 2).toFixed(2));
    pill.setAttribute("y", py.toFixed(2));
    pill.setAttribute("width", pw.toFixed(2));
    pill.setAttribute("height", ph.toFixed(2));
    pill.setAttribute("rx", (ph / 2).toFixed(2));
    pill.setAttribute("opacity", clamp(pillOp.x, 0, 1).toFixed(3));

    // 3. Active Hairline index dot gliding along lower rail
    idot.setAttribute("cx", dotX.x.toFixed(2));
    idot.setAttribute("cy", (BASE_Y + BASE_H - 7).toFixed(2));

    // 4. Canopy copy perfectly centered inside the exact clamped upper dome!
    const cProg = clamp((canopyH.x - 16) / 30, 0, 1);
    const curFillet = Math.min(26, 12 + canopyH.x * 0.28);
    const curMargin = BASE_H / 2 + canopyHW.x + curFillet * 0.82;
    const clampedCX = clamp(focusX.x, (X0 - breatheX.x) + curMargin, (X1 + breatheX.x) - curMargin);
    canopyLbl.style.opacity = cProg.toFixed(3);
    canopyLbl.style.transform = `translate3d(${clampedCX.toFixed(1)}px, ${(BASE_Y - canopyH.x + 10).toFixed(1)}px, 0) translateX(-50%) scale(${(0.92 + cProg * 0.08).toFixed(3)})`;

    // 5. Place sculptural icons with gentle spatial parting & elevation
    for (let i = 0; i < btns.length; i++) {
      const cx = restCenterX(i) + slotShift[i].x;
      const cy = BASE_Y + BASE_H / 2 + slotLift[i].x;
      btns[i].style.transform = `translate3d(${(cx - 22).toFixed(1)}px, ${(cy - 22).toFixed(1)}px, 0)`;
    }

    // Fit cleanly on narrow mobile screens (zero layout read in RAF!)
    const fitScale = SVG_W > cachedAvailW ? cachedAvailW / SVG_W : 1;
    wrap.style.transform = `scale(${fitScale.toFixed(4)})`;

    return moving;
  }

  const unsub = clock.subscribe((dt) => renderFrame(dt));
  renderFrame(0);

  return {
    setVirtualHover(idx, vx = 1.0) { updateHover(hoveredIdx, idx, vx); },
    setVirtualPress(idx, down) {
      pressedIdx = down ? idx : -1;
      if (idx >= 0) icons[idx].setPress(down);
      updateHover(hoveredIdx, idx, 0);
    },
    setActive,
    getTelemetry() {
      return {
        id: "system-b",
        widthDelta: +(breatheX.x * 2).toFixed(1),
        heightDelta: +canopyH.x.toFixed(1),
        hoveredIdx,
        activeId,
        slotWidths: slotShift.map((s) => Math.round(SLOT_STEP + s.x)),
      };
    },
    destroy() {
      ro.disconnect();
      unsub();
      icons.forEach((ic) => ic.destroy());
    },
  };
}
