/**
 * 006 · one light for every surface.
 *
 * Whitespace's optical studies light glass from where the hand is. Here a single passive listener
 * does it for the whole app: the control under the pointer gets its own --lx/--ly (px, in its own
 * box) and a soft specular spot rides there (controls.css · .lit). Nothing animates while the
 * pointer is still; nothing listens per control; touch never lights anything.
 */
const LIT = ".btn, .seg, .bar-field, .bar-btn, .chip, .cmap3-home, .wander-enter, .wander-close, .bl, .nrow, .club";
let cur: HTMLElement | null = null;
let raf = 0, px = 0, py = 0, tgt: EventTarget | null = null;

function frame() {
  raf = 0;
  const el = (tgt instanceof Element ? tgt.closest(LIT) : null) as HTMLElement | null;
  if (el !== cur) { cur?.classList.remove("is-lit"); cur = el; el?.classList.add("lit", "is-lit"); }
  if (el) {
    const r = el.getBoundingClientRect();
    el.style.setProperty("--lx", `${(px - r.left).toFixed(1)}px`);
    el.style.setProperty("--ly", `${(py - r.top).toFixed(1)}px`);
  }
}
export function installLight() {
  if (matchMedia("(hover: none)").matches) return;
  addEventListener("pointermove", (e) => {
    if (e.pointerType === "touch") return;
    px = e.clientX; py = e.clientY; tgt = e.target;
    if (!raf) raf = requestAnimationFrame(frame);
  }, { passive: true });
  document.addEventListener("pointerleave", () => { cur?.classList.remove("is-lit"); cur = null; });
}
