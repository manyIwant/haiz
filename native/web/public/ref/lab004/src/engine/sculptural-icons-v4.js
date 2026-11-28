/**
 * HAIZ Experiment 004 · Sculptural Kinetic Icon Artworks (v4 — Muse × Hairline)
 *
 * Crafted after 18fps forensic analysis of the Muse recording:
 *   - Bold, uncrowded 28×28 optical field with confident 1.85px carbon strokes & rounded joins
 *   - Every icon performs ONE unmistakable, full-silhouette physical transformation on hover & impulse
 *     (never tiny 2px wiggles!):
 *       1. campus     : 1923 一号楼门廊 — roof pediment lifts & double portal gates fold open in 3D
 *       2. canopy     : 百年榄仁叶冠   — full 3D leaf-turn along midrib + sequential vein draw + wind carry
 *       3. instrument : 力学摆与标尺   — true damped harmonic pendulum absorbing cursor horizontal impulse vx!
 *       4. folio      : 双叶折页       — authentic Muse vertical scroll/page-peel flip over top spine!
 *       5. lens       : 45° 翻镜       — authentic Muse full 90°->180° diagonal coin-axis flip!
 *
 * All icon motion obeys the shared deterministic MotionClock so 0.12× slow-mo and single-frame
 * stepping inspect every degree of the 3D flip, leaf twist, gate opening, and pendulum swing!
 */

import { makeSpring, stepSpring, clamp } from "./clock-physics.js";

const SVG_NS = "http://www.w3.org/2000/svg";
function mk(tag, attrs = {}, parent = null) {
  const n = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  if (parent) parent.appendChild(n);
  return n;
}

export function mountSculpturalIconV4(host, kind, clock, { size = 26 } = {}) {
  host.innerHTML = "";
  const svg = mk("svg", {
    viewBox: "0 0 28 28",
    width: size,
    height: size,
    class: "v4-icon",
    "aria-hidden": "true",
  }, host);

  const root = mk("g", { class: "v4-root" }, svg);
  const p = {};

  // ==================== 1. CAMPUS · 1923 PORTAL GATE ====================
  if (kind === "campus") {
    p.base = mk("path", { d: "M4.5 22.5 H23.5", class: "v4-sub" }, root);
    p.pillars = mk("path", { d: "M7.2 22.5 V12.4 M20.8 22.5 V12.4", class: "v4-pri" }, root);
    // Double doors that physically swing open in perspective!
    p.doorL = mk("path", { d: "M10.4 22.5 V15.0 H14.0 V22.5", class: "v4-sec" }, root);
    p.doorR = mk("path", { d: "M17.6 22.5 V15.0 H14.0 V22.5", class: "v4-sec" }, root);
    p.roofGrp = mk("g", {}, root);
    p.eave = mk("path", { d: "M4.8 12.6 L14 6.6 L23.2 12.6", class: "v4-pri" }, p.roofGrp);
    p.crest = mk("path", { d: "M9.6 9.6 L14 6.6 L18.4 9.6", class: "v4-fine" }, p.roofGrp);
    p.dot = mk("circle", { cx: 14, cy: 18.4, r: 1.4, class: "v4-dot" }, root);
  }

  // ==================== 2. CANOPY · TERMINALIA LEAF TURN ====================
  else if (kind === "canopy") {
    p.twistGrp = mk("g", {}, root);
    p.stem = mk("path", { d: "M14 23.2 V17.2", class: "v4-pri" }, p.twistGrp);
    // Iconic plump obovate Terminalia leaf silhouette
    p.blade = mk("path", { d: "M14 19.2 C8.0 18.2 5.8 13.0 8.2 8.4 C10.0 5.0 12.6 4.4 14 4.4 C15.4 4.4 18.0 5.0 19.8 8.4 C22.2 13.0 20.0 18.2 14 19.2 Z", class: "v4-pri" }, p.twistGrp);
    p.midrib = mk("path", { d: "M14 18.8 V7.0", class: "v4-sec" }, p.twistGrp);
    p.veinL = mk("path", { d: "M14 14.5 L10.2 11.4 M14 11.0 L11.1 8.7", class: "v4-fine", "stroke-dasharray": "10", "stroke-dashoffset": "10" }, p.twistGrp);
    p.veinR = mk("path", { d: "M14 14.5 L17.8 11.4 M14 11.0 L16.9 8.7", class: "v4-fine", "stroke-dasharray": "10", "stroke-dashoffset": "10" }, p.twistGrp);
    p.dot = mk("circle", { cx: 14, cy: 12.0, r: 1.35, class: "v4-dot" }, p.twistGrp);
  }

  // ==================== 3. INSTRUMENT · PHYSICAL HARMONIC PENDULUM ====================
  else if (kind === "instrument") {
    p.arc = mk("path", { d: "M6.5 19.4 A9.2 9.2 0 0 0 21.5 19.4", class: "v4-sub" }, root);
    p.bar = mk("path", { d: "M6.2 6.8 H21.8", class: "v4-pri" }, root);
    p.pivot = mk("circle", { cx: 14, cy: 6.8, r: 1.5, class: "v4-dot" }, root);
    p.armGrp = mk("g", {}, root);
    p.rod = mk("path", { d: "M14 6.8 V17.2", class: "v4-pri" }, p.armGrp);
    p.bob = mk("circle", { cx: 14, cy: 19.4, r: 2.8, class: "v4-pri" }, p.armGrp);
    p.bobDot = mk("circle", { cx: 14, cy: 19.4, r: 1.0, class: "v4-dot" }, p.armGrp);
  }

  // ==================== 4. FOLIO · MUSE VERTICAL PAGE-PEEL FLIP ====================
  else if (kind === "folio") {
    p.spine = mk("path", { d: "M7.6 6.8 H20.4", class: "v4-pri" }, root);
    // Back sheet revealed during flip!
    p.backSheet = mk("rect", { x: 6.8, y: 6.8, width: 14.4, height: 15.6, rx: 2.8, class: "v4-sub" }, root);
    // Front page that curls & flips vertically over the top spine (exact Muse motion grammar!)
    p.flipSheet = mk("g", {}, root);
    p.frontBox = mk("rect", { x: 6.8, y: 6.8, width: 14.4, height: 15.6, rx: 2.8, class: "v4-pri v4-fill" }, p.flipSheet);
    p.line1 = mk("path", { d: "M10.2 12.2 H17.8", class: "v4-sec", "stroke-dasharray": "9", "stroke-dashoffset": "0" }, p.flipSheet);
    p.line2 = mk("path", { d: "M10.2 16.0 H15.6", class: "v4-fine", "stroke-dasharray": "7", "stroke-dashoffset": "0" }, p.flipSheet);
    p.dot = mk("circle", { cx: 17.6, cy: 18.6, r: 1.3, class: "v4-dot" }, p.flipSheet);
  }

  // ==================== 5. LENS · MUSE 45° COIN-AXIS FLIP ====================
  else {
    p.flipGrp = mk("g", {}, root);
    p.ring = mk("circle", { cx: 12.5, cy: 12.5, r: 6.4, class: "v4-pri" }, p.flipGrp);
    p.glint = mk("path", { d: "M9.6 11.4 A3.5 3.5 0 0 1 13.7 9.1", class: "v4-fine" }, p.flipGrp);
    p.handle = mk("path", { d: "M17.4 17.4 L22.4 22.4", class: "v4-pri" }, p.flipGrp);
    p.dot = mk("circle", { cx: 12.5, cy: 12.5, r: 1.35, class: "v4-dot" }, p.flipGrp);
  }

  // Continuous physics channels
  const morph = makeSpring(0, { k: 250, c: 22, eps: 0.0008 });
  // Bold underdamped impulse channel (`flip` / `pendulum` / `breeze`) that visibly finishes its arc!
  const pulse = makeSpring(0, { k: 135, c: 9.8, eps: 0.0008 });
  const lean  = makeSpring(0, { k: 210, c: 19, eps: 0.0008 });

  let hovered = false, pressed = false, active = false;
  let flipPhase = 0; // accumulates 0 -> PI for full Muse 180° flip events without snapping!
  const flipSp = makeSpring(0, { k: 155, c: 16.5, eps: 0.001 });

  function syncTarget() {
    if (pressed) morph.t = active ? 0.72 : 0.38;
    else if (active) morph.t = 1.0;
    else if (hovered) morph.t = 0.65;
    else morph.t = 0.0;
    clock.wake();
  }

  function render() {
    const m = clamp(morph.x, -0.2, 1.35);
    const k = clamp(pulse.x, -2.2, 2.2);
    const l = clamp(lean.x, -1.2, 1.2);
    const lit = m > 0.42 || Math.abs(k) > 0.35;

    // Gentle sculptural poise + directional lean from neighbor yielding
    const sc = 1 + m * 0.045 - (pressed ? 0.08 : 0);
    root.setAttribute(
      "transform",
      `translate(14 14) translate(${(l * 1.6).toFixed(2)} 0) rotate(${(l * 7.0).toFixed(2)}) scale(${sc.toFixed(3)}) translate(-14 -14)`
    );

    if (kind === "campus") {
      // Bold roof lift + double portal doors folding cleanly open!
      const lift = -m * 2.5 - Math.abs(k) * 0.7;
      p.roofGrp.setAttribute("transform", `translate(0 ${lift.toFixed(2)}) rotate(${(k * 7.5).toFixed(1)} 14 9)`);
      const openFactor = clamp(m * 1.1 + Math.abs(k) * 0.25, 0, 1);
      const sxDoor = Math.max(0.18, 1 - openFactor * 0.74);
      p.doorL.setAttribute("transform", `translate(10.4 0) scale(${sxDoor.toFixed(3)} 1) translate(-10.4 0)`);
      p.doorR.setAttribute("transform", `translate(17.6 0) scale(${sxDoor.toFixed(3)} 1) translate(-17.6 0)`);
      p.dot.setAttribute("cy", (18.6 - openFactor * 2.4).toFixed(2));
      p.dot.setAttribute("r", (0.75 + openFactor * 0.95).toFixed(2));
      p.dot.classList.toggle("is-lit", lit);
    }

    else if (kind === "canopy") {
      // Full 3D leaf-turn twist along its vertical stem axis + drawing lateral veins!
      const twistCos = Math.cos(flipSp.x);
      const sx = Math.max(0.24, Math.abs(twistCos));
      const sway = k * 11.5;
      p.twistGrp.setAttribute("transform", `translate(14 21) rotate(${sway.toFixed(1)}) scale(${sx.toFixed(3)} 1) translate(-14 -21)`);
      const vOff = (10 * (1 - clamp(m * 1.35, 0, 1))).toFixed(2);
      p.veinL.setAttribute("stroke-dashoffset", vOff);
      p.veinR.setAttribute("stroke-dashoffset", vOff);
      p.dot.setAttribute("r", (0.8 + m * 0.75).toFixed(2));
      p.dot.classList.toggle("is-lit", lit);
    }

    else if (kind === "instrument") {
      // True damped harmonic pendulum absorbing cursor horizontal impulse!
      const swingDeg = clamp(k * 28 + m * 6 * (k >= 0 ? 1 : -1), -42, 42);
      p.armGrp.setAttribute("transform", `rotate(${swingDeg.toFixed(1)} 14 6.8)`);
      p.pivot.classList.toggle("is-lit", lit);
      p.bobDot.classList.toggle("is-lit", lit);
      p.bobDot.setAttribute("r", (0.8 + m * 0.65).toFixed(2));
    }

    else if (kind === "folio") {
      // Authentic Muse vertical page-peel flip over top spine (y=6.8)!
      const c = Math.cos(flipSp.x);
      const sy = Math.max(0.16, Math.abs(c));
      const skew = Math.sin(flipSp.x) * 9;
      p.flipSheet.setAttribute("transform", `translate(14 6.8) skewX(${skew.toFixed(1)}) scale(1 ${sy.toFixed(3)}) translate(-14 -6.8)`);
      const dash = (9 * (1 - clamp(0.35 + m * 0.65, 0, 1))).toFixed(2);
      p.line1.setAttribute("stroke-dashoffset", dash);
      p.dot.classList.toggle("is-lit", lit);
    }

    else {
      // Authentic Muse 45° diagonal coin-axis flip (goes razor-thin edge-on at 90°, snaps open at 180°!)
      const sx = Math.max(0.12, Math.abs(Math.cos(flipSp.x)));
      const rot = k * 9;
      p.flipGrp.setAttribute("transform", `translate(14 14) rotate(-45) scale(${sx.toFixed(3)} 1) rotate(${(45 + rot).toFixed(1)}) translate(-14 -14)`);
      p.glint.setAttribute("opacity", (0.35 + m * 0.65).toFixed(2));
      p.dot.setAttribute("r", (0.75 + m * 0.75).toFixed(2));
      p.dot.classList.toggle("is-lit", lit);
    }
  }

  const unsub = clock.subscribe((dt) => {
    if (dt === 0) { render(); return false; }
    let moving = false;
    if (stepSpring(morph, dt)) moving = true;
    if (stepSpring(pulse, dt)) moving = true;
    if (stepSpring(lean, dt)) moving = true;
    if (stepSpring(flipSp, dt)) moving = true;
    render();
    return moving;
  });

  render();

  return {
    setHover(on, vx = 0) {
      const entering = on && !hovered;
      hovered = Boolean(on);
      if (entering) {
        const dir = Math.abs(vx) > 0.04 ? Math.sign(vx) : 1;
        const speed = clamp(Math.abs(vx) || 1.1, 0.75, 2.6);
        pulse.v += dir * speed * 7.8;
        // Trigger clean 180° Muse flip advance on flip-based artworks (interruptible & never snaps!)
        if (kind === "lens" || kind === "folio" || kind === "canopy") {
          flipPhase += Math.PI * (dir >= 0 ? 1 : -1);
          flipSp.t = flipPhase;
        }
      } else if (!on && Math.abs(vx) > 0.08) {
        pulse.v += clamp(vx * 3.2, -6, 6);
      }
      syncTarget();
    },
    injectImpulse(vx) {
      pulse.v += clamp(vx * 6.5, -10, 10);
      clock.wake();
    },
    setPress(on) {
      pressed = Boolean(on);
      if (on) pulse.v -= 2.4;
      syncTarget();
    },
    setActive(on) {
      const changed = active !== Boolean(on);
      active = Boolean(on);
      if (changed && on) {
        pulse.v += 4.2;
        if (kind === "lens" || kind === "folio") {
          flipPhase += Math.PI;
          flipSp.t = flipPhase;
        }
      }
      syncTarget();
    },
    setLean(val) {
      lean.t = clamp(val, -1, 1);
      clock.wake();
    },
    getMetrics() {
      return { morph: +morph.x.toFixed(3), pulse: +pulse.x.toFixed(3), lean: +lean.x.toFixed(3) };
    },
    destroy() { unsub(); },
  };
}
