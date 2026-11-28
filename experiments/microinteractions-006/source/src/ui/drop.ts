/**
 * 液滴 · the optical-drop skin (006).
 *
 * 005's glaze (Skin) is frosted: it hides what is under it, which is right for a dock and wrong
 * for something that grows *out of* the page. A drop is clear: it magnifies a little, it is lit
 * from the upper left so its curvature shows (a specular sheen computed from the shape itself by
 * an SVG lighting filter, not painted on), its lower edge gathers light like a meniscus, and it
 * casts a soft contact shadow onto the paper it sits on. Give it a path (from kernel/liquid); it
 * draws. The path is the same one the hairline datum follows, so surface and line never part.
 */
let seq = 0;
export class Drop {
  el: HTMLDivElement;
  private paths: SVGPathElement[];
  private masks: SVGPathElement[];
  private glass: HTMLDivElement;
  private last = "";
  constructor(parent: HTMLElement, cls = "") {
    const id = "dr" + ++seq;
    const el = (this.el = document.createElement("div"));
    el.className = "drop " + cls;
    el.innerHTML = `
      <svg class="drop-shadow" aria-hidden="true"><path data-p/></svg>
      <div class="drop-glass"></div>
      <svg class="drop-skin" aria-hidden="true">
        <defs>
          <radialGradient id="${id}g" cx="0.32" cy="0.18" r="0.95">
            <stop offset="0" style="stop-color: var(--drop-hi)"/>
            <stop offset="0.55" style="stop-color: var(--drop-mid)"/>
            <stop offset="1" style="stop-color: var(--drop-lo)"/>
          </radialGradient>
          <filter id="${id}s" x="-10%" y="-30%" width="120%" height="160%" color-interpolation-filters="sRGB">
            <feGaussianBlur in="SourceAlpha" stdDeviation="4.5" result="b"/>
            <feSpecularLighting in="b" surfaceScale="5" specularConstant="0.9" specularExponent="22" lighting-color="#fff" result="s">
              <fePointLight x="-60" y="-120" z="160"/>
            </feSpecularLighting>
            <feComposite in="s" in2="SourceAlpha" operator="in"/>
          </filter>
          <mask id="${id}t" maskUnits="userSpaceOnUse" x="-3000" y="-3000" width="9000" height="9000"><path data-p fill="#fff"/><path data-p fill="#000" transform="translate(1.2 1.6)"/></mask>
          <mask id="${id}b" maskUnits="userSpaceOnUse" x="-3000" y="-3000" width="9000" height="9000"><path data-p fill="#fff"/><path data-p fill="#000" transform="translate(-0.6 -2.2)"/></mask>
          <mask id="${id}o" maskUnits="userSpaceOnUse" x="-3000" y="-3000" width="9000" height="9000"><rect x="-3000" y="-3000" width="9000" height="9000" fill="#fff"/><path data-p fill="#000"/></mask>
        </defs>
        <path data-p class="drop-body" fill="url(#${id}g)"/>
        <path data-p class="drop-sheen" filter="url(#${id}s)"/>
        <path data-p class="drop-caustic" mask="url(#${id}b)"/>
        <path data-p class="drop-rim" mask="url(#${id}t)"/>
        <path data-p class="drop-edge" mask="url(#${id}o)"/>
      </svg>`;
    parent.appendChild(el);
    const all = [...el.querySelectorAll<SVGPathElement>("[data-p]")];
    this.masks = all.filter((p) => p.closest("mask"));
    this.paths = all.filter((p) => !p.closest("mask"));
    this.glass = el.querySelector(".drop-glass")!;
  }
  /** d in the skin's own frame; the skin box is placed at (x, y) with size w × h */
  draw(d: string, x = 0, y = 0, w = 0, h = 0) {
    const key = d + "|" + x.toFixed(1) + "," + y.toFixed(1) + "," + w.toFixed(0) + "," + h.toFixed(0);
    if (key === this.last) return;
    this.last = key;
    this.el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
    if (w && h) { this.el.style.width = `${Math.ceil(w)}px`; this.el.style.height = `${Math.ceil(h)}px`; }
    for (const p of this.paths) p.setAttribute("d", d);
    for (const p of this.masks) p.setAttribute("d", d);
    this.glass.style.clipPath = d ? `path('${d}')` : "inset(50%)";
    this.el.style.visibility = d ? "visible" : "hidden";
  }
  destroy() { this.el.remove(); }
}
