/**
 * 琉璃 · the glaze skin for any one-contour surface: a frosted, tinted body with a soft shadow,
 * an edge stroked only on the OUTSIDE of the union (so internal joins never show) and a lit rim
 * on its upward faces. Give it a path; it draws.
 */
let seq = 0;
export class Skin {
  el: HTMLDivElement;
  private body: SVGPathElement;
  private edge: SVGPathElement;
  private rim: SVGPathElement;
  private masks: SVGPathElement[];
  private glass: HTMLDivElement;
  private last = "";
  constructor(parent: HTMLElement, cls = "") {
    const id = "sk" + ++seq;
    const el = (this.el = document.createElement("div"));
    el.className = "skin " + cls;
    el.innerHTML = `
      <svg class="skin-body" aria-hidden="true"><path/></svg>
      <div class="skin-glass"></div>
      <svg class="skin-edge" aria-hidden="true">
        <defs>
          <mask id="${id}r" maskUnits="userSpaceOnUse" x="-3000" y="-3000" width="9000" height="9000"><path fill="#fff"/><path fill="#000" transform="translate(0 1.4)"/></mask>
          <mask id="${id}o" maskUnits="userSpaceOnUse" x="-3000" y="-3000" width="9000" height="9000"><rect x="-3000" y="-3000" width="9000" height="9000" fill="#fff"/><path fill="#000"/></mask>
        </defs>
        <path class="skin-rim" mask="url(#${id}r)"/>
        <path class="skin-stroke" mask="url(#${id}o)"/>
      </svg>`;
    parent.appendChild(el);
    this.body = el.querySelector(".skin-body path")!;
    this.edge = el.querySelector(".skin-stroke")!;
    this.rim = el.querySelector(".skin-rim")!;
    this.masks = [...el.querySelectorAll<SVGPathElement>("mask path")];
    this.glass = el.querySelector(".skin-glass")!;
  }
  /** d is in the local frame of the box (x, y, w, h) — the glass only ever covers that box */
  draw(d: string, x = 0, y = 0, w = 0, h = 0) {
    const key = d + x.toFixed(1) + y.toFixed(1);
    if (key === this.last) return;
    this.last = key;
    this.el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
    if (w && h) { this.el.style.width = `${Math.ceil(w)}px`; this.el.style.height = `${Math.ceil(h)}px`; }
    this.body.setAttribute("d", d);
    this.edge.setAttribute("d", d);
    this.rim.setAttribute("d", d);
    for (const m of this.masks) m.setAttribute("d", d);
    this.glass.style.clipPath = d ? `path('${d}')` : "inset(50%)";
  }
  destroy() { this.el.remove(); }
}
