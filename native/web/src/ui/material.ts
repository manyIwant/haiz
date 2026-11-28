/**
 * 材质预算 · material budget helpers (HAIZ Native 003).
 *
 * On Android the WebView redraws the whole frame whenever anything moves, so every visible
 * backdrop blur and every SVG filter is paid on every frame of a gesture. These helpers keep the
 * look and cut the pixels:
 *  - blurred material (shadows) is rendered at 1 CSS px per pixel instead of the device's 3, which
 *    cannot be seen in something that is a blur to begin with (9× fewer pixels);
 *  - the frosted glass reads only the box around the shape, not the whole layer.
 * Geometry, text and icons stay at full resolution.
 */

/**
 * Experiment switches for device A/B runs (perf panel › 实验, or ?mat=a,b in the URL):
 *  legacy-shadow  the old device-resolution SVG drop-shadow on membranes
 *  full-glass     the frosted glass reads the whole layer again
 *  no-glass       no backdrop blur on the dock / drawer drop at all (diagnosis only)
 */
export const MAT = new Set<string>();
try {
  const q = new URLSearchParams(location.search).get("mat") ?? localStorage.getItem("haiz:mat") ?? "";
  for (const k of q.split(",")) if (k.trim()) MAT.add(k.trim());
} catch { /* private mode */ }
export function setMat(k: string, on: boolean) {
  if (on) MAT.add(k); else MAT.delete(k);
  try { localStorage.setItem("haiz:mat", [...MAT].join(",")); } catch { /* private */ }
  document.documentElement.dataset.mat = [...MAT].join(" ");
}
if (typeof document !== "undefined") document.documentElement.dataset.mat = [...MAT].join(" ");

const PAIR = /(-?\d+(?:\.\d+)?)[ ,](-?\d+(?:\.\d+)?)/g;

/** bounding box of a path built from absolute M/L/C pairs (kernel/membrane, kernel/liquid) */
export function pathBox(d: string): { x0: number; y0: number; x1: number; y1: number } | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  PAIR.lastIndex = 0;
  for (let m = PAIR.exec(d); m; m = PAIR.exec(d)) {
    const x = +m[1], y = +m[2];
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return x0 === Infinity ? null : { x0, y0, x1, y1 };
}

/** the same absolute path moved by (dx, dy) */
export function shiftPath(d: string, dx: number, dy: number): string {
  if (!dx && !dy) return d;
  return d.replace(PAIR, (_, x, y) => `${(+x + dx).toFixed(2)} ${(+y + dy).toFixed(2)}`);
}

/* --------------------------------------------------------------- shadows */
type Shade = { x: number; y: number; r: number; color: string };
let shadeCache: { key: string; shades: Shade[]; fillA: number } | null = null;
const themeKey = () => (document.documentElement.dataset.theme || "") + (matchMedia("(prefers-color-scheme: dark)").matches ? "d" : "l");
function readShades(): { shades: Shade[]; fillA: number } {
  const key = themeKey();
  if (shadeCache && shadeCache.key === key) return shadeCache;
  const cs = getComputedStyle(document.documentElement);
  const raw = cs.getPropertyValue("--glaze-shadow");
  const shades: Shade[] = [];
  const re = /drop-shadow\(\s*(-?[\d.]+)(?:px)?\s+(-?[\d.]+)(?:px)?\s+([\d.]+)(?:px)?\s+(rgba?\([^)]*\))\s*\)/g;
  for (let m = re.exec(raw); m; m = re.exec(raw)) shades.push({ x: +m[1], y: +m[2], r: +m[3], color: m[4] });
  const g = cs.getPropertyValue("--glaze").match(/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/);
  shadeCache = { key, shades, fillA: g ? +g[1] : 1 };
  return shadeCache;
}

/**
 * The glaze's soft shadow, drawn under a membrane at 1 px per CSS px. Same look as
 * `filter: var(--glaze-shadow)` on the membrane (alpha follows the glaze fill, as drop-shadow does),
 * without re-filtering a device-resolution layer on every frame of a morph.
 */
export class SoftShadow {
  readonly el: HTMLCanvasElement;
  private g: CanvasRenderingContext2D | null;
  private last = "";
  private pad = 48;
  private d = "";
  private stop: () => void;
  /** pixels per CSS px of the shadow's own bitmap (0.5: a 12 px blur becomes a 6 px one, then stretched) */
  constructor(cls: string, private res = 0.5) {
    this.el = document.createElement("canvas");
    this.el.className = cls;
    this.el.setAttribute("aria-hidden", "true");
    this.el.style.cssText = "position:absolute;left:0;top:0;pointer-events:none;";
    this.g = this.el.getContext("2d");
    // the theme changes the shadow even when the shape does not move
    const again = () => { shadeCache = null; this.last = ""; this.draw(this.d); };
    const mo = new MutationObserver(again);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
    const mq = matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", again);
    this.stop = () => { mo.disconnect(); mq.removeEventListener("change", again); };
  }
  draw(d: string) {
    this.d = d;
    if (MAT.has("legacy-shadow")) { this.el.style.visibility = "hidden"; this.last = ""; return; }
    const key = d + themeKey();
    if (key === this.last || !this.g) return;
    this.last = key;
    const b = d ? pathBox(d) : null;
    const g = this.g;
    if (!b) { this.el.style.visibility = "hidden"; return; }
    const { shades, fillA } = readShades();
    const p = this.pad;
    const k = this.res;
    // the bitmap only grows (in steps), so a morph does not reallocate it on every frame
    const w = Math.ceil(b.x1 - b.x0 + 2 * p), h = Math.ceil(b.y1 - b.y0 + 2 * p);
    const bw = Math.ceil((w * k) / 16) * 16, bh = Math.ceil((h * k) / 16) * 16;
    if (this.el.width < bw || this.el.height < bh) { this.el.width = Math.max(bw, this.el.width); this.el.height = Math.max(bh, this.el.height); }
    else g.clearRect(0, 0, this.el.width, this.el.height);
    this.el.style.width = this.el.width / k + "px"; this.el.style.height = this.el.height / k + "px";
    const ox = Math.floor(b.x0) - p, oy = Math.floor(b.y0) - p;
    this.el.style.transform = `translate3d(${ox}px, ${oy}px, 0)`;
    this.el.style.visibility = "visible";
    const path = new Path2D(shiftPath(d, -ox, -oy));
    g.save();
    g.globalAlpha = fillA;
    for (const s of shades) {
      // drop-shadow(x y r) is a Gaussian with σ = r / 2
      g.filter = s.r > 0 ? `blur(${((s.r / 2) * k).toFixed(2)}px)` : "none";
      g.fillStyle = s.color;
      g.setTransform(k, 0, 0, k, s.x * k, s.y * k);
      g.fill(path);
    }
    g.restore();
  }
  destroy() { this.stop(); this.el.remove(); }
}
