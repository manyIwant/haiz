/**
 * HAIZ Experiment 004 · System C: 「折痕舞台 · 空间生长仪」 (Crease Stage / Architectural Unfolding)
 *
 * Spatial Architecture (Hairline Riffle + Terrain + Spatial Growth):
 *   - At rest: ultra-minimal 54px monochrome drafting bar traversed by ONE continuous 1px Hairline
 *     architectural datum wire and a single emerald Hairline index mark.
 *   - On hover:
 *       1. The entire vessel unfolds upward (+72px height, +78px width) into an integrated operational
 *          stage (micro-workspace) directly attached to the navigation bar!
 *       2. The continuous 1px Hairline datum wire physically bends & lifts beneath the hovered entry
 *          like a taut architectural string pulled by a caliper!
 *       3. Neighbors part cleanly outward (±12px) AND rotate away in 3D perspective (rotateY ±22°),
 *          staggered outward by distance from the pointer (Hairline Rule 02)!
 *       4. Moving from entry A -> B slides the interior operational tray along the EXACT horizontal
 *          direction of approach (kinetic directional handoff!), with 3 live clickable micro-actions!
 */

import { DOCK_ITEMS } from "../data/dock-items.js";
import { mountSculpturalIconV4 } from "../engine/sculptural-icons-v4.js";
import { makeSpring, stepSpring, createVelocityTracker, clamp, smoothstep } from "../engine/clock-physics.js";

const REST_W = 312;
const OPEN_W = 392;
const REST_H = 54;
const OPEN_H = 128;

export function mountDockCreaseStage({ host, clock, onSelect, onAction, onMirrorHover, onMirrorLeave }) {
  host.innerHTML = `
    <div class="dc-stage" data-stage>
      <div class="dc-vessel" data-vessel>
        <div class="dc-tray" data-tray>
          <div class="dc-tray-inner" data-tray-inner>
            <div class="dc-tray-head">
              <span class="dc-code mono" data-t-code>01</span>
              <strong class="dc-title" data-t-title>府城建筑 · 1923</strong>
              <span class="dc-sub" data-t-sub>一号楼 · 北门 · 图书馆</span>
            </div>
            <div class="dc-actions" data-t-actions></div>
          </div>
        </div>

        <svg class="dc-wire-svg" viewBox="0 0 392 22" preserveAspectRatio="none" aria-hidden="true">
          <path class="dc-wire-path" data-wire></path>
          <circle class="dc-wire-dot" data-wdot r="2.6"></circle>
        </svg>

        <div class="dc-rail" data-rail></div>
      </div>
    </div>
  `;

  const vessel = host.querySelector("[data-vessel]");
  const trayEl = host.querySelector("[data-tray]");
  const trayInner = host.querySelector("[data-tray-inner]");
  const tCode = host.querySelector("[data-t-code]");
  const tTitle = host.querySelector("[data-t-title]");
  const tSub = host.querySelector("[data-t-sub]");
  const tActions = host.querySelector("[data-t-actions]");
  const wirePath = host.querySelector("[data-wire]");
  const wdot = host.querySelector("[data-wdot]");
  const railEl = host.querySelector("[data-rail]");

  let cachedAvailW = Math.max(290, (host.clientWidth || window.innerWidth) - 20);
  const ro = new ResizeObserver((entries) => {
    const w = entries[0]?.contentRect?.width;
    if (w) cachedAvailW = Math.max(290, w - 20);
  });
  ro.observe(host);

  const vel = createVelocityTracker();
  let hoveredIdx = -1;
  let pressedIdx = -1;
  let activeIdx = 0;
  let activeId = DOCK_ITEMS[0].id;
  let trayItemIdx = 0;

  const vW = makeSpring(REST_W, { k: 225, c: 23, eps: 0.1 });
  const vH = makeSpring(REST_H, { k: 215, c: 22, eps: 0.1 });
  const openSp = makeSpring(0, { k: 210, c: 22, eps: 0.002 });
  const wirePeakX = makeSpring(0.1, { k: 255, c: 24, eps: 0.001 }); // normalized [0..1]
  const wireLift = makeSpring(0, { k: 240, c: 22, eps: 0.05 });
  const traySlideX = makeSpring(0, { k: 260, c: 24, eps: 0.08 });

  const partX = DOCK_ITEMS.map(() => makeSpring(0, { k: 230, c: 21, eps: 0.05 }));
  const tiltY = DOCK_ITEMS.map(() => makeSpring(0, { k: 220, c: 21, eps: 0.05 }));
  const liftY = DOCK_ITEMS.map(() => makeSpring(0, { k: 240, c: 21, eps: 0.05 }));

  const btns = [];
  const icons = [];

  DOCK_ITEMS.forEach((item, i) => {
    const b = document.createElement("button");
    b.className = `dc-btn ${i === activeIdx ? "is-active" : ""}`;
    b.dataset.id = item.id;
    b.setAttribute("aria-label", `${item.fullTitle} · ${item.sub}`);
    b.innerHTML = `<span class="dc-ic"></span><span class="dc-mini-lbl">${item.title}</span>`;
    railEl.appendChild(b);
    btns.push(b);

    const ic = mountSculpturalIconV4(b.querySelector(".dc-ic"), item.id, clock, { size: 25 });
    ic.setActive(i === activeIdx);
    icons.push(ic);
  });

  function populateTray(idx, dir = 1) {
    trayItemIdx = idx;
    const meta = DOCK_ITEMS[idx];
    tCode.textContent = meta.code;
    tTitle.textContent = meta.fullTitle;
    tSub.textContent = meta.sub;
    tActions.innerHTML = meta.actions.map((a) => `<button class="dc-act-chip" data-act="${a}">${a}</button>`).join("");
    tActions.querySelectorAll("[data-act]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        setActive(meta.id);
        onAction?.(meta, btn.dataset.act);
      });
    });
    // Kinetic directional handoff: new workspace glides in along hand vector!
    traySlideX.x = dir * 28;
    traySlideX.t = 0;
    traySlideX.v = -dir * 40;
  }

  populateTray(0, 0);

  function updateHover(prevIdx, nextIdx, vx = 0) {
    hoveredIdx = nextIdx;
    const on = nextIdx >= 0;

    if (on) {
      vW.t = OPEN_W;
      vH.t = pressedIdx === nextIdx ? OPEN_H - 5 : OPEN_H;
      openSp.t = 1;
      const normX = (nextIdx + 0.5) / DOCK_ITEMS.length;
      if (prevIdx < 0) wirePeakX.x = normX;
      wirePeakX.t = normX;
      wireLift.t = pressedIdx === nextIdx ? 6 : 11.5;

      if (nextIdx !== trayItemIdx || prevIdx < 0) {
        const dir = prevIdx >= 0 ? Math.sign(nextIdx - prevIdx) : Math.sign(vx || 1);
        populateTray(nextIdx, dir || 1);
      }
      if (prevIdx >= 0 && Math.abs(nextIdx - prevIdx) > 1) {
        const dir = Math.sign(nextIdx - prevIdx);
        for (let k = Math.min(prevIdx, nextIdx) + 1; k < Math.max(prevIdx, nextIdx); k++) {
          icons[k].injectImpulse(dir * 1.3);
        }
      }
    } else {
      vW.t = REST_W;
      vH.t = REST_H;
      openSp.t = 0;
      wirePeakX.t = (activeIdx + 0.5) / DOCK_ITEMS.length;
      wireLift.t = 0;
    }

    DOCK_ITEMS.forEach((_, i) => {
      if (!on) {
        partX[i].t = 0;
        tiltY[i].t = 0;
        liftY[i].t = 0;
        icons[i].setHover(false, i === prevIdx ? vx : 0);
        icons[i].setLean(0);
      } else {
        const d = i - nextIdx;
        const ad = Math.abs(d);
        // Hairline Riffle spatial parting + 3D perspective turn away from focus stage!
        partX[i].t = ad === 0 ? 0 : Math.sign(d) * (ad === 1 ? 13 : 7);
        tiltY[i].t = ad === 0 ? 0 : Math.sign(d) * (ad === 1 ? -22 : -11);
        liftY[i].t = ad === 0 ? (pressedIdx === i ? 0 : -4.5) : 1.5;
        icons[i].setHover(ad === 0, ad === 0 ? vx : (i === prevIdx ? vx * 0.5 : 0));
        icons[i].setLean(ad === 0 ? 0 : Math.sign(d) * 0.4);
      }
    });
    clock.wake();
  }

  function setActive(id) {
    const idx = DOCK_ITEMS.findIndex((x) => x.id === id);
    if (idx < 0) return;
    activeId = id;
    activeIdx = idx;
    if (hoveredIdx < 0) wirePeakX.t = (idx + 0.5) / DOCK_ITEMS.length;
    btns.forEach((b, i) => {
      b.classList.toggle("is-active", i === idx);
      icons[i].setActive(i === idx);
    });
    wireLift.v += 55;
    clock.wake();
  }

  function hitIndexFromClientX(clientX) {
    const r = railEl.getBoundingClientRect();
    const u = (clientX - r.left) / Math.max(1, r.width);
    if (u < -0.05 || u > 1.05) return -1;
    return clamp(Math.floor(u * DOCK_ITEMS.length), 0, DOCK_ITEMS.length - 1);
  }

  let touchActive = false;

  railEl.addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch" && !touchActive) return;
    clock.markInput();
    const v = vel.sample(e.clientX, e.clientY);
    const idx = hitIndexFromClientX(e.clientX);
    if (idx >= 0 && idx !== hoveredIdx) {
      updateHover(hoveredIdx, idx, v.vx);
      onMirrorHover?.(idx, v.vx);
    }
  });
  vessel.addEventListener("pointerleave", (e) => {
    if (e.pointerType === "touch") return;
    vel.reset();
    pressedIdx = -1;
    icons.forEach((ic) => ic.setPress(false));
    updateHover(hoveredIdx, -1, 0);
    onMirrorLeave?.();
  });
  railEl.addEventListener("pointerdown", (e) => {
    clock.markInput();
    const idx = hitIndexFromClientX(e.clientX);
    if (idx < 0) return;
    if (e.pointerType === "touch") {
      touchActive = true;
      railEl.setPointerCapture?.(e.pointerId);
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
      onSelect?.(DOCK_ITEMS[tIdx], "system-c");
    }
    if (e.pointerType === "touch") {
      touchActive = false;
      updateHover(hoveredIdx, -1, 0);
    } else {
      updateHover(hoveredIdx, hoveredIdx, 0);
    }
  };
  railEl.addEventListener("pointerup", handleUp);
  railEl.addEventListener("pointercancel", () => {
    touchActive = false;
    if (pressedIdx >= 0) icons[pressedIdx].setPress(false);
    pressedIdx = -1;
    updateHover(hoveredIdx, -1, 0);
  });

  function renderFrame(dt) {
    let moving = false;
    if (dt > 0 && stepSpring(vW, dt)) moving = true;
    if (dt > 0 && stepSpring(vH, dt)) moving = true;
    if (dt > 0 && stepSpring(openSp, dt)) moving = true;
    if (dt > 0 && stepSpring(wirePeakX, dt)) moving = true;
    if (dt > 0 && stepSpring(wireLift, dt)) moving = true;
    if (dt > 0 && stepSpring(traySlideX, dt)) moving = true;
    for (let i = 0; i < DOCK_ITEMS.length; i++) {
      if (dt > 0 && stepSpring(partX[i], dt)) moving = true;
      if (dt > 0 && stepSpring(tiltY[i], dt)) moving = true;
      if (dt > 0 && stepSpring(liftY[i], dt)) moving = true;
    }

    const fitScale = vW.x > cachedAvailW ? cachedAvailW / vW.x : 1;

    vessel.style.width = `${vW.x.toFixed(1)}px`;
    vessel.style.height = `${vH.x.toFixed(1)}px`;
    vessel.style.transform = `scale(${fitScale.toFixed(4)})`;

    // Unfolding operational tray
    const trayReveal = smoothstep(0.18, 0.88, openSp.x);
    trayEl.style.opacity = trayReveal.toFixed(3);
    trayEl.style.pointerEvents = trayReveal > 0.5 ? "auto" : "none";
    trayInner.style.transform = `translate3d(${traySlideX.x.toFixed(1)}px, ${((1 - trayReveal) * 10).toFixed(1)}px, 0)`;

    // Continuous 1px Hairline Architectural Datum Wire bending upward into a crisp caliper peak!
    const W = 392, railPad = 10, yBase = 16;
    const px = clamp(railPad + wirePeakX.x * (W - railPad * 2), 36, W - 36);
    const lift = clamp(wireLift.x, 0, 14);
    const spread = 52;
    const d = `M 14 ${yBase} L ${Math.max(14, px - spread).toFixed(1)} ${yBase} C ${(px - spread * 0.45).toFixed(1)} ${yBase}, ${(px - spread * 0.35).toFixed(1)} ${(yBase - lift).toFixed(1)}, ${px.toFixed(1)} ${(yBase - lift).toFixed(1)} C ${(px + spread * 0.35).toFixed(1)} ${(yBase - lift).toFixed(1)}, ${(px + spread * 0.45).toFixed(1)} ${yBase}, ${Math.min(W - 14, px + spread).toFixed(1)} ${yBase} L ${W - 14} ${yBase}`;
    wirePath.setAttribute("d", d);
    wdot.setAttribute("cx", px.toFixed(1));
    wdot.setAttribute("cy", (yBase - lift).toFixed(1));

    // Parting & 3D perspective turning of rail icons!
    for (let i = 0; i < btns.length; i++) {
      btns[i].style.transform = `translate3d(${partX[i].x.toFixed(1)}px, ${liftY[i].x.toFixed(1)}px, 0) perspective(240px) rotateY(${tiltY[i].x.toFixed(1)}deg)`;
    }

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
        id: "system-c",
        widthDelta: +(vW.x - REST_W).toFixed(1),
        heightDelta: +(vH.x - REST_H).toFixed(1),
        hoveredIdx,
        activeId,
        slotWidths: partX.map((s) => Math.round(s.x)),
      };
    },
    destroy() {
      ro.disconnect();
      unsub();
      icons.forEach((ic) => ic.destroy());
    },
  };
}
