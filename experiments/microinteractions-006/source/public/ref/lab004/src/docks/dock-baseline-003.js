/**
 * HAIZ Experiment 004 · Control Baseline: Lab 003 Dock (Static Vessel)
 *
 * Preserved intentionally as an honest reference baseline:
 *   - Fixed container width & height (ΔW = 0, ΔH = 0)
 *   - Independent fixed slots with zero spatial yielding and zero container participation
 *   - Simple sliding light halo + floating detached tooltip
 */

import { DOCK_ITEMS } from "../data/dock-items.js";
import { makeSpring, stepSpring, clamp } from "../engine/clock-physics.js";

const SVG_NS = "http://www.w3.org/2000/svg";
function mk(tag, attrs = {}, parent = null) {
  const n = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  if (parent) parent.appendChild(n);
  return n;
}

const SIMPLE_PATHS = {
  campus: "M5 21 H23 M7 21 V12 H21 V21 M5.5 12 L14 6.5 L22.5 12",
  canopy: "M14 22 V13 M7 15 C9.5 10.5 18.5 10.5 21 15 M9 11 C11 7.5 17 7.5 19 11",
  instrument: "M5 18 H23 M9 12 H17 V16 H9 Z",
  folio: "M7 6 H21 V22 H7 Z M10 11 H18 M10 15 H16",
  lens: "M12.5 12.5 m-5.5 0 a5.5 5.5 0 1 0 11 0 a5.5 5.5 0 1 0 -11 0 M16.6 16.6 L21.5 21.5",
};

export function mountDockBaseline003({ host, clock, onSelect, onMirrorHover, onMirrorLeave }) {
  host.innerHTML = `
    <div class="d03-shell" data-shell>
      <div class="d03-halo" data-halo></div>
      <div class="d03-items" data-items></div>
    </div>
  `;

  const shell = host.querySelector("[data-shell]");
  const halo = host.querySelector("[data-halo]");
  const itemsEl = host.querySelector("[data-items]");

  let hoveredIdx = -1;
  let activeId = DOCK_ITEMS[0].id;
  const haloX = makeSpring(0, { k: 270, c: 26, eps: 0.1 });
  const scales = DOCK_ITEMS.map(() => makeSpring(0, { k: 220, c: 22, eps: 0.002 }));
  const btns = [];
  const gs = [];

  DOCK_ITEMS.forEach((it, idx) => {
    const b = document.createElement("button");
    b.className = `d03-btn ${it.id === activeId ? "is-on" : ""}`;
    b.dataset.idx = String(idx);
    b.innerHTML = `<span class="d03-ic"></span><span class="d03-lbl">${it.title}</span>`;
    itemsEl.appendChild(b);
    btns.push(b);

    const svg = mk("svg", { viewBox: "0 0 28 28", width: 22, height: 22, "aria-hidden": "true" }, b.querySelector(".d03-ic"));
    const g = mk("g", {}, svg);
    mk("path", { d: SIMPLE_PATHS[it.id], fill: "none", stroke: "currentColor", "stroke-width": "1.6", "stroke-linecap": "round", "stroke-linejoin": "round" }, g);
    gs.push(g);

    b.addEventListener("pointerenter", () => {
      clock.markInput();
      applyHover(idx, 1);
      onMirrorHover?.(idx, 1);
    });
    b.addEventListener("click", () => {
      setActive(it.id);
      onSelect?.(it, "baseline-003");
    });
  });

  shell.addEventListener("pointerleave", () => {
    applyHover(-1, 0);
    onMirrorLeave?.();
  });

  function applyHover(idx) {
    hoveredIdx = idx;
    DOCK_ITEMS.forEach((it, i) => {
      scales[i].t = i === idx ? 0.65 : (it.id === activeId ? 1 : 0);
    });
    if (idx >= 0) {
      const sr = shell.getBoundingClientRect();
      const br = btns[idx].getBoundingClientRect();
      const x = br.left - sr.left;
      if (!halo.classList.contains("is-show")) haloX.x = x;
      haloX.t = x;
      halo.style.width = `${br.width}px`;
      halo.classList.add("is-show");
    } else {
      halo.classList.remove("is-show");
    }
    clock.wake();
  }

  function setActive(id) {
    activeId = id;
    btns.forEach((b, i) => {
      const on = DOCK_ITEMS[i].id === id;
      b.classList.toggle("is-on", on);
      scales[i].t = on ? 1 : (i === hoveredIdx ? 0.65 : 0);
    });
    clock.wake();
  }

  const unsub = clock.subscribe((dt) => {
    let m = false;
    if (dt > 0 && stepSpring(haloX, dt)) m = true;
    halo.style.transform = `translate3d(${haloX.x.toFixed(1)}px, 0, 0)`;
    scales.forEach((s, i) => {
      if (dt > 0 && stepSpring(s, dt)) m = true;
      gs[i].setAttribute("transform", `translate(14 14) translate(0 ${(-s.x * 1.4).toFixed(2)}) scale(${(1 + s.x * 0.08).toFixed(3)}) translate(-14 -14)`);
    });
    return m;
  });

  return {
    setVirtualHover: (idx) => applyHover(idx),
    setVirtualPress: () => {},
    setActive,
    getTelemetry: () => ({
      id: "baseline",
      widthDelta: 0,
      heightDelta: 0,
      hoveredIdx,
      activeId,
      slotWidths: DOCK_ITEMS.map(() => 64),
    }),
    destroy: () => unsub(),
  };
}
