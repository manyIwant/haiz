/**
 * HAIZ 005 · 舰 (the fused dock)
 *
 * One component, one contour, three depths of one gesture:
 *
 *   掠 Pass   the pointer (or a finger scrubbing) crosses the capsule. The focused bay takes the
 *             room its label needs from its neighbours by distance (让位 — total width is nearly
 *             conserved, so the capsule barely grows); the contour swells over it (同源); the
 *             liquid plate follows with a velocity stretch; neighbours' icons lean away.
 *   停 Dwell  ~280 ms of stillness (or a 380 ms long-press) and the swell keeps rising: the SAME
 *             outline grows a stage with that destination's live summary and actions (生长).
 *             Moving to another bay slides the open stage over; it never closes and reopens.
 *   入 Enter  a click/tap commits: the lit mark travels the datum to the new bay (基准).
 *
 * Experiment 004 drew these as three separate docks (A yields, B is one liquid membrane, C grows a
 * crease stage). Here they are the three depths of one surface. Every number is a spring on the
 * one clock, so any gesture can be interrupted, reversed or redirected mid-flight.
 *
 * The phone form adds a satellite lens; reaching for it grows a liquid neck between the two, and
 * opening it hands the capsule's room to a search field that grows its results upward.
 */
import { clock, spring, stepS, settle, SP, clamp, falloff, lerp, type Spring } from "../../kernel/motion";
import { stack, rrectPath, neckPath, type Box } from "../../kernel/membrane";
import { mountIcon, type IconKind, type KineticIcon } from "../../icons/kinetic";
import { velocityTracker } from "../../kernel/react";

export type DockItem = {
  id: string;
  icon?: IconKind;
  label: string;
  /** a text bay (the focus timer) instead of an icon */
  text?: string;
  badge?: boolean;
  /** base width override, px */
  wide?: number;
  /** the stage this bay grows on dwell; null = none */
  stage?: { w: number; h: number } | null;
};
export type DockConfig = {
  items: DockItem[];
  active: string | null;
  satellite: { id: string; icon: IconKind; label: string } | null;
  size: "phone" | "desk";
  searchOpen: boolean;
  searchStage: { w: number; h: number } | null;
  /** keep the stage of this id open (e.g. a quick-input stage being typed into) */
  pinStage?: string | null;
};
export type DockCallbacks = {
  onEnter(id: string): void;
  onStage(id: string | null): void;
  onSearch(open: boolean): void;
  onQuery?(q: string): void;
};

type Bay = {
  item: DockItem;
  el: HTMLButtonElement;
  ico: HTMLSpanElement;
  labWrap: HTMLSpanElement;
  lab: HTMLSpanElement;
  icon: KineticIcon | null;
  w: Spring;
  lean: number;
  labelW: number;
  leaving: boolean;
  x: number;
  cw: number;
};

const METRIC = {
  phone: { H: 58, b: 62, pad: 5, gap: 10, bottom: 14, margin: 14, swellH: 6 },
  desk: { H: 52, b: 56, pad: 5, gap: 10, bottom: 18, margin: 18, swellH: 5 },
};
const DWELL_MS = 280;
const LONG_MS = 380;
const LEAVE_MS = 150;

export class DockEngine {
  root: HTMLDivElement;
  stageHost: HTMLDivElement;
  stageInner: HTMLDivElement;
  satStageHost: HTMLDivElement;
  satStageInner: HTMLDivElement;
  input: HTMLInputElement;

  private cfg: DockConfig;
  private cb: DockCallbacks;
  private bays: Bay[] = [];
  private svgBody: SVGSVGElement;
  private pBody: SVGPathElement;
  private pEdge: SVGPathElement;
  private pRim: SVGPathElement;
  private rimClip: SVGPathElement;
  private rimGrad: SVGMaskElement;
  private maskPaths: SVGPathElement[] = [];
  private lastMoveAt = 0;
  private datumGrad!: SVGLinearGradientElement;
  private creaseGrad!: SVGLinearGradientElement;
  private lastTouch = 0;
  private pDatum: SVGPathElement;
  private pCrease: SVGPathElement;
  private glass: HTMLDivElement;
  private plate: HTMLDivElement;
  private dot: HTMLDivElement;
  private hit: HTMLDivElement;
  private satHit: HTMLButtonElement;
  private satIco: HTMLSpanElement;
  private satIcon: KineticIcon | null = null;
  private bayLayer: HTMLDivElement;

  // springs
  private plateX = spring(0, SP.ui);
  private plateW = spring(0, SP.ui);
  private dotX = spring(0, SP.ui);
  private stCx = spring(0, SP.lift);
  private stW = spring(0, SP.lift);
  private stH = spring(0, { k: 210, c: 24.5 });
  private stR = spring(9, SP.lift);
  private stF = spring(13, SP.lift);
  private search = spring(0, SP.soft);
  private sat = spring(1, SP.lift);
  private neck = spring(0, { k: 260, c: 22 });
  private resH = spring(0, { k: 200, c: 24 });

  // interaction
  private focus = -1;          // index of the bay in focus (pass), -1 none
  private hoverSat = false;
  private staged: string | null = null;
  private dwellT = 0;
  private longT = 0;
  private leaveT = 0;
  private engaged = false;
  private touch: { id: number; x0: number; y0: number; moved: boolean; long: boolean } | null = null;
  private stickyStage = false;
  private vel = velocityTracker();
  private vx = 0;
  private width = 390;
  private height = 0;
  /** Native 001 · what the last frame was drawn from: when nothing it reads has changed and no
   * spring moved, the frame would write exactly the same styles again, so it is skipped. */
  private lastSig: unknown[] = [];
  private lastMoving = true;
  private lastPath = "";
  private offTick: () => void;
  private ro: ResizeObserver | null = null;
  private plateShown = spring(0, SP.ui);
  private hotEl: Element | null = null;
  private kbd = false;
  /** Native 002 · the bay just entered, shown as active at once (plate, dot, icon) while the page it
   * opens is still rendering; dropped when the app catches up, or after 2.5 s if it never does. */
  private pending: { id: string; at: number } | null = null;
  private shownActive: string | null | undefined = undefined;
  /** Native 002 · the layer is only as tall as what it draws: a ~120 px strip at rest instead of
   * 560 px, so the SVG contour, its drop shadow and the backdrop blur raster ~5× fewer pixels on
   * every frame of a gesture and every frame of a page scroll under it. */
  private tall = true;

  constructor(host: HTMLElement, cfg: DockConfig, cb: DockCallbacks) {
    this.cfg = cfg;
    this.cb = cb;
    const root = (this.root = document.createElement("div"));
    root.className = `dock dock--${cfg.size}`;
    root.innerHTML = `
      <svg class="dock-body" aria-hidden="true"><path class="dock-fill"/></svg>
      <div class="dock-glass"></div>
      <svg class="dock-edge" aria-hidden="true">
        <defs>
          <mask id="dock-rim-clip" maskUnits="userSpaceOnUse" x="-2000" y="-2000" width="6000" height="6000">
            <path class="m-in" fill="#fff"/><path class="m-sh" fill="#000" transform="translate(0 1.4)"/>
          </mask>
          <mask id="dock-rim-grad" maskUnits="userSpaceOnUse" x="-2000" y="-2000" width="6000" height="6000">
            <rect x="-2000" y="-2000" width="6000" height="6000" fill="#fff"/><path class="m-out" fill="#000"/>
          </mask>
          <linearGradient id="dock-datum-grad" gradientUnits="userSpaceOnUse" x1="0" x2="100" y1="0" y2="0">
            <stop offset="0" stop-color="currentColor" stop-opacity="0"/>
            <stop offset=".2" stop-color="currentColor" stop-opacity="1"/>
            <stop offset=".8" stop-color="currentColor" stop-opacity="1"/>
            <stop offset="1" stop-color="currentColor" stop-opacity="0"/>
          </linearGradient>
          <linearGradient id="dock-crease-grad" gradientUnits="userSpaceOnUse" x1="0" x2="100" y1="0" y2="0">
            <stop offset="0" stop-color="currentColor" stop-opacity="0"/>
            <stop offset=".25" stop-color="currentColor" stop-opacity="1"/>
            <stop offset=".75" stop-color="currentColor" stop-opacity="1"/>
            <stop offset="1" stop-color="currentColor" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <path class="dock-rim"/>
        <path class="dock-stroke"/>
        <path class="dock-datum"/>
        <path class="dock-crease"/>
      </svg>
      <div class="dock-plate"></div>
      <div class="dock-dot"></div>
      <div class="dock-hit"></div>
      <div class="dock-bays" role="navigation"></div>
      <button class="dock-sat" type="button"><span class="dock-sat-ico"></span><input class="dock-input" type="search" enterkeyhint="search" autocomplete="off" spellcheck="false" tabindex="-1"/></button>
      <div class="dock-stage" aria-live="polite"><div class="dock-stage-in"></div></div>
      <div class="dock-stage dock-stage--sat"><div class="dock-stage-in"></div></div>`;
    host.appendChild(root);
    const q = <T extends Element>(s: string) => root.querySelector(s) as T;
    this.svgBody = q("svg.dock-body");
    this.pBody = q(".dock-fill");
    this.pEdge = q(".dock-stroke");
    this.pRim = q(".dock-rim");
    this.rimClip = q("#dock-rim-clip path");
    this.rimGrad = q("#dock-rim-grad");
    this.pDatum = q(".dock-datum");
    this.pCrease = q(".dock-crease");
    this.glass = q(".dock-glass");
    this.plate = q(".dock-plate");
    this.dot = q(".dock-dot");
    this.hit = q(".dock-hit");
    this.bayLayer = q(".dock-bays");
    this.satHit = q(".dock-sat");
    this.satIco = q(".dock-sat-ico");
    this.input = q(".dock-input");
    const stages = root.querySelectorAll<HTMLDivElement>(".dock-stage");
    this.stageHost = stages[0];
    this.stageInner = stages[0].firstElementChild as HTMLDivElement;
    this.satStageHost = stages[1];
    this.satStageInner = stages[1].firstElementChild as HTMLDivElement;
    // unique ids per instance (the bench mounts several docks)
    const uid = Math.random().toString(36).slice(2, 7);
    // the rim: the union minus itself shifted down — a lit crescent on upward faces only
    q<SVGMaskElement>("#dock-rim-clip").id = `dock-rim-clip-${uid}`;
    this.pRim.setAttribute("mask", `url(#dock-rim-clip-${uid})`);
    // the edge: stroke kept only OUTSIDE the union, so inner chords of the neck never show
    this.rimGrad.id = `dock-rim-grad-${uid}`;
    this.pEdge.setAttribute("mask", `url(#dock-rim-grad-${uid})`);
    this.maskPaths = [...root.querySelectorAll<SVGPathElement>(".m-in, .m-sh, .m-out")];
    this.datumGrad = q<SVGLinearGradientElement>("#dock-datum-grad");
    this.datumGrad.id = `dock-datum-grad-${uid}`;
    this.pDatum.setAttribute("stroke", `url(#dock-datum-grad-${uid})`);
    this.creaseGrad = q<SVGLinearGradientElement>("#dock-crease-grad");
    this.creaseGrad.id = `dock-crease-grad-${uid}`;
    this.pCrease.setAttribute("stroke", `url(#dock-crease-grad-${uid})`);
    document.fonts?.ready.then(() => {
      for (const b of this.bays) b.labelW = this.measureLabel(b.lab);
      this.layoutTargets();
      clock.wake();
    });

    this.syncItems(true);
    this.syncSatellite();
    this.bindPointer();
    this.measure();
    this.ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => { this.measure(); clock.wake(); }) : null;
    this.ro?.observe(root);
    this.offTick = clock.add((dt) => this.tick(dt));
    this.settleAll();
  }

  /* ------------------------------------------------------------------ config */

  private get active(): string | null {
    const p = this.pending;
    if (p) {
      if (this.cfg.active === p.id || this.cfg.active === null || performance.now() - p.at > 2500) this.pending = null;
      else return p.id;
    }
    return this.cfg.active;
  }
  private syncActive() {
    const a = this.active;
    if (a === this.shownActive) return;
    this.shownActive = a;
    for (const b of this.bays) b.icon?.setActive(b.item.id === a);
  }

  update(cfg: DockConfig) {
    const prev = this.cfg;
    this.cfg = cfg;
    if (prev.size !== cfg.size) this.root.className = `dock dock--${cfg.size}`;
    this.syncItems(false);
    this.layoutTargets();
    if ((prev.satellite?.id ?? "") !== (cfg.satellite?.id ?? "")) this.syncSatellite();
    if (prev.searchOpen !== cfg.searchOpen) {
      this.search.t = cfg.searchOpen ? 1 : 0;
      this.root.classList.toggle("is-search", cfg.searchOpen);
      this.input.tabIndex = cfg.searchOpen ? 0 : -1;
      if (cfg.searchOpen) {
        this.setStaged(null);
        this.focus = -1;
        requestAnimationFrame(() => this.input.focus({ preventScroll: true }));
      } else {
        this.input.value = "";
        this.input.blur();
      }
    }
    if (prev.active !== cfg.active) this.syncActive();
    if (cfg.pinStage && cfg.pinStage !== this.staged) {
      const i = this.bays.findIndex((b) => b.item.id === cfg.pinStage);
      if (i >= 0) { this.focus = i; this.setStaged(cfg.pinStage); this.stickyStage = true; }
    }
    clock.wake();
  }

  private syncItems(initial: boolean) {
    const ids = new Set(this.cfg.items.map((i) => i.id));
    for (const b of this.bays) if (!ids.has(b.item.id)) { b.leaving = true; b.el.tabIndex = -1; b.el.setAttribute("aria-hidden", "true"); }
    const next: Bay[] = [];
    for (const item of this.cfg.items) {
      let b = this.bays.find((x) => x.item.id === item.id && !x.leaving);
      if (!b) b = this.makeBay(item, initial);
      else {
        const iconChanged = b.item.icon !== item.icon;
        b.item = item;
        if (item.text !== undefined) b.ico.textContent = item.text;
        if (iconChanged && item.icon) { b.icon?.destroy(); b.icon = mountIcon(b.ico, item.icon, this.cfg.size === "phone" ? 25 : 23); }
        b.lab.textContent = item.label;
        b.el.setAttribute("aria-label", item.label);
        b.el.classList.toggle("has-badge", !!item.badge);
      }
      next.push(b);
    }
    // keep leaving bays in place (by their old order) so the morph closes their gaps smoothly
    const leaving = this.bays.filter((b) => b.leaving);
    const ordered: Bay[] = [];
    const oldOrder = this.bays.map((b) => b.item.id);
    const all = [...next, ...leaving.filter((l) => !next.includes(l))];
    all.sort((a, b) => {
      const ia = next.indexOf(a), ib = next.indexOf(b);
      if (ia >= 0 && ib >= 0) return ia - ib;
      const oa = oldOrder.indexOf(a.item.id), ob = oldOrder.indexOf(b.item.id);
      const ra = ia >= 0 ? ia : oa, rb = ib >= 0 ? ib : ob;
      return ra - rb || (ia >= 0 ? 1 : -1);
    });
    ordered.push(...all);
    this.bays = ordered;
    this.shownActive = undefined;
    this.syncActive();
    if (this.focus >= this.bays.length) this.focus = -1;
  }

  private makeBay(item: DockItem, initial: boolean): Bay {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "dock-bay" + (item.text !== undefined ? " dock-bay--text" : "");
    el.setAttribute("aria-label", item.label);
    el.innerHTML = `<span class="dock-ico"></span><span class="dock-lab-wrap"><span class="dock-lab"></span></span>`;
    const ico = el.querySelector(".dock-ico") as HTMLSpanElement;
    const labWrap = el.querySelector(".dock-lab-wrap") as HTMLSpanElement;
    const lab = el.querySelector(".dock-lab") as HTMLSpanElement;
    lab.textContent = item.label;
    let icon: KineticIcon | null = null;
    if (item.text !== undefined) ico.textContent = item.text;
    else if (item.icon) icon = mountIcon(ico, item.icon, this.cfg.size === "phone" ? 25 : 23);
    el.classList.toggle("has-badge", !!item.badge);
    this.bayLayer.appendChild(el);
    const b: Bay = { item, el, ico, labWrap, lab, icon, w: spring(initial ? this.baseW(item) : 0, SP.lift), lean: 0, labelW: 0, leaving: false, x: 0, cw: 0 };
    b.labelW = this.measureLabel(lab);
    el.addEventListener("click", (e) => {
      if (this.touch || performance.now() - this.lastTouch < 600) return; // touch commits on pointerup
      this.enter(this.bays.indexOf(b));
    });
    el.addEventListener("focus", () => {
      if (!el.matches(":focus-visible")) return;
      this.kbd = true;
      this.setFocus(this.bays.indexOf(b), 0);
    });
    el.addEventListener("blur", () => {
      if (!this.kbd) return;
      setTimeout(() => { if (!this.root.contains(document.activeElement)) { this.kbd = false; this.release(); } }, 0);
    });
    el.addEventListener("keydown", (e) => this.onKey(e, b));
    return b;
  }

  private measureLabel(lab: HTMLElement) {
    const w = lab.getBoundingClientRect().width || lab.textContent!.length * 13;
    return Math.ceil(w);
  }

  private syncSatellite() {
    const s = this.cfg.satellite;
    this.sat.t = s ? 1 : 0;
    this.satIcon?.destroy();
    this.satIcon = null;
    if (s) {
      this.satIcon = mountIcon(this.satIco, s.icon, 24);
      this.satHit.setAttribute("aria-label", s.label);
      this.input.placeholder = "搜索课程、通知、地点、功能";
      this.input.setAttribute("aria-label", "搜索");
    }
    this.satHit.style.display = s ? "" : "none";
  }

  private baseW(item: DockItem) {
    const m = METRIC[this.cfg.size];
    return item.wide ?? this.bayBase(m);
  }
  private bayBase(m: typeof METRIC.phone) {
    if (this.cfg.size !== "phone") return m.b;
    const n = Math.max(1, this.cfg.items.filter((i) => !i.wide).length);
    const wideSum = this.cfg.items.reduce((a, i) => a + (i.wide ?? 0), 0);
    const room = this.width - 2 * m.margin - (this.cfg.satellite ? m.H + m.gap : 0) - 2 * m.pad - wideSum - 6;
    return clamp(room / n, 48, m.b);
  }

  private measure() {
    this.width = this.root.clientWidth || window.innerWidth;
    this.height = this.root.clientHeight;
  }

  private settleAll() {
    this.tick(0);
    for (const b of this.bays) settle(b.w, b.w.t);
    const m = METRIC[this.cfg.size];
    const a = this.bays.findIndex((b) => b.item.id === this.active);
    this.layoutTargets();
    this.tick(0);
    if (a >= 0) {
      settle(this.plateX, this.bays[a].x + this.bays[a].cw / 2);
      settle(this.plateW, this.bays[a].cw);
      settle(this.dotX, this.bays[a].x + this.bays[a].cw / 2);
      settle(this.plateShown, 1);
    }
    settle(this.stH, 0);
    settle(this.search, this.cfg.searchOpen ? 1 : 0);
    settle(this.sat, this.cfg.satellite ? 1 : 0);
    void m;
    this.tick(0);
  }

  /* ------------------------------------------------------------------ layout */

  /** widths each bay is heading to, given the focus (让位: what the focus gains, neighbours give back) */
  private targetWidths(fi: number): number[] {
    const m = METRIC[this.cfg.size];
    const live = this.bays.map((b, i) => (b.leaving ? -1 : i)).filter((i) => i >= 0);
    const s = this.cfg.searchOpen;
    const out = this.bays.map((b) => (b.leaving ? 0 : this.baseW(b.item)));
    if (s) {
      const a = this.bays.findIndex((b) => b.item.id === this.active && !b.leaving);
      return this.bays.map((_, i) => (i === (a >= 0 ? a : live[0]) ? m.H - 2 * m.pad : 0));
    }
    if (fi < 0 || this.bays[fi]?.leaving) return out;
    const fb = this.bays[fi];
    const E = fb.item.text !== undefined ? 0 : fb.labelW + 9;
    out[fi] += E;
    // the neighbours give back ~55% of it by distance — the capsule grows by the rest
    const G = E * 0.55;
    const reach = 2.2;
    let sw = 0;
    const ws = this.bays.map((b, i) => {
      if (i === fi || b.leaving) return 0;
      const rank = Math.abs(live.indexOf(i) - live.indexOf(fi));
      const w = falloff((rank - 1) / reach);
      sw += w;
      return w;
    });
    if (sw > 0) this.bays.forEach((b, i) => { if (ws[i]) out[i] -= Math.min(this.baseW(b.item) * 0.2, (G * ws[i]) / sw); });
    return out;
  }

  private layoutTargets() {
    const tw = this.targetWidths(this.focus);
    this.bays.forEach((b, i) => { b.w.t = tw[i]; });
    // neighbours lean away from the focus (cleared when there is none)
    const live = this.bays.map((b, i) => (b.leaving ? -1 : i)).filter((i) => i >= 0);
    this.bays.forEach((b, i) => {
      let lean = 0;
      if (this.focus >= 0 && i !== this.focus && !b.leaving) {
        const d = live.indexOf(i) - live.indexOf(this.focus);
        lean = Math.sign(d) * falloff((Math.abs(d) - 1) / 2) * 0.55;
      }
      if (Math.abs(lean - b.lean) > 0.01) { b.lean = lean; b.icon?.setLean(lean); }
    });
  }

  /** where the current focus sits in its own TARGET layout (for exit-only switching) */
  private focusTargetExtent(): [number, number] | null {
    if (this.focus < 0) return null;
    const m = METRIC[this.cfg.size];
    const tw = this.targetWidths(this.focus);
    const total = tw.reduce((a, b) => a + b, 0) + 2 * m.pad;
    const left = this.capLeftFor(total);
    let x = left + m.pad;
    for (let i = 0; i < this.focus; i++) x += tw[i];
    return [x, x + tw[this.focus]];
  }
  /** the bay under x in the REST layout — deterministic, so focus can never ping-pong */
  private restIndex(x: number): number {
    const m = METRIC[this.cfg.size];
    const tw = this.targetWidths(-1);
    const total = tw.reduce((a, b) => a + b, 0) + 2 * m.pad;
    let p = this.capLeftFor(total) + m.pad;
    let best = -1;
    for (let i = 0; i < this.bays.length; i++) {
      if (this.bays[i].leaving) { continue; }
      best = best < 0 ? i : best;
      if (x < p + tw[i]) return i;
      p += tw[i];
      best = i;
    }
    return best;
  }

  private capLeftFor(capW: number) {
    const m = METRIC[this.cfg.size];
    const s = this.cfg.searchOpen ? 1 : 0;
    const satW = this.cfg.satellite ? m.H + m.gap : 0;
    const centred = (this.width - (capW + satW)) / 2;
    return lerp(centred, m.margin, s);
  }

  /* ------------------------------------------------------------------ interaction */

  private setFocus(i: number, vx: number) {
    if (i === this.focus) return;
    const prev = this.focus;
    if (prev >= 0 && this.bays[prev]) this.bays[prev].icon?.setHover(false, vx);
    this.focus = i;
    if (i >= 0 && this.bays[i]) this.bays[i].icon?.setHover(true, vx);
    this.layoutTargets();
    // dwell: a still pointer on one bay for ~280ms grows its stage; if a stage is already open,
    // it simply slides to the new bay (redirection, not close-and-reopen)
    clearTimeout(this.dwellT);
    if (i >= 0) {
      const item = this.bays[i].item;
      if (this.staged) this.setStaged(item.stage ? item.id : null);
      else if (item.stage && !this.touch) this.dwellT = window.setTimeout(() => this.maybeDwell(), DWELL_MS / Math.max(0.05, clock.scale));
    }
    clock.wake();
  }

  private maybeDwell() {
    if (this.focus < 0 || this.cfg.searchOpen) return;
    if (performance.now() - this.lastMoveAt < 70 && Math.abs(this.vel.vx) > 0.35) { this.dwellT = window.setTimeout(() => this.maybeDwell(), 90); return; }
    const item = this.bays[this.focus].item;
    if (item.stage) this.setStaged(item.id);
  }

  private setStaged(id: string | null) {
    if (this.staged === id) return;
    this.staged = id;
    if (!id) this.stickyStage = false;
    this.root.classList.toggle("is-staged", !!id);
    this.stageHost.classList.toggle("is-open", !!id);
    this.cb.onStage(id);
    clock.wake();
  }

  /** the pointer left everything: fold the stage, release the focus, the plate returns home */
  private release() {
    clearTimeout(this.dwellT);
    clearTimeout(this.longT);
    if (this.cfg.pinStage) return;
    if (this.stickyStage && this.staged) return;
    this.setStaged(null);
    this.setFocus(-1, this.vx);
    this.hoverSat = false;
    this.satIcon?.setHover(false);
    this.engaged = false;
  }

  enter(i: number) {
    const b = this.bays[i];
    if (!b || b.leaving) return;
    b.icon?.setPress(false);
    if (b.item.stage && this.cfg.size === "desk" && this.staged !== b.item.id) {
      // tools with a stage: a click opens it at once (no dwell needed) and keeps it until done
      this.focus = i; this.layoutTargets();
      this.stickyStage = true;
      this.setStaged(b.item.id);
      return;
    }
    this.setStaged(null);
    this.stickyStage = false;
    const id = b.item.id;
    // selection migrates now, on the dock's own frames; the page follows a frame later, so the
    // first frame of the answer is never stuck behind the new page's render
    const nav = this.cfg.size === "phone" ? !id.startsWith("f:") : id.startsWith("go:");
    if (nav && this.cfg.active !== null && id !== this.cfg.active) { this.pending = { id, at: performance.now() }; this.syncActive(); }
    clock.markInput();
    requestAnimationFrame(() => setTimeout(() => this.cb.onEnter(id), 0));
  }

  closeStage() { this.stickyStage = false; this.setStaged(null); if (!this.engaged) this.setFocus(-1, 0); }

  private onKey(e: KeyboardEvent, b: Bay) {
    const live = this.bays.filter((x) => !x.leaving);
    const i = live.indexOf(b);
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const n = live[clamp(i + (e.key === "ArrowRight" ? 1 : -1), 0, live.length - 1)];
      n.el.focus();
    } else if (e.key === "ArrowUp" && b.item.stage) {
      e.preventDefault();
      this.stickyStage = true;
      this.setStaged(b.item.id);
      requestAnimationFrame(() => (this.stageInner.querySelector("button, input, [tabindex]") as HTMLElement | null)?.focus());
    } else if (e.key === "Escape") {
      this.closeStage();
    }
  }

  private local(e: PointerEvent) {
    const r = this.root.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private capBox(): Box {
    const m = METRIC[this.cfg.size];
    const h = this.height || this.root.clientHeight;
    const total = this.bays.reduce((a, b) => a + b.w.x, 0) + 2 * m.pad;
    const x0 = this.capLeftFor(total);
    return { x0, x1: x0 + total, y0: h - m.bottom - m.H, y1: h - m.bottom, R: m.H / 2 };
  }

  private inside(x: number, y: number) {
    const c = this.capBox();
    const pad = 10;
    if (x > c.x0 - pad && x < c.x1 + pad && y > c.y0 - pad - (this.staged ? 0 : 6) && y < c.y1 + pad) return true;
    if (this.staged || this.cfg.searchOpen) {
      const r = this.stageHost.getBoundingClientRect(), o = this.root.getBoundingClientRect();
      if (x > r.left - o.left - pad && x < r.right - o.left + pad && y > r.top - o.top - pad && y < r.bottom - o.top + 4) return true;
    }
    if (this.cfg.satellite) {
      const s = this.satHit.getBoundingClientRect(), o = this.root.getBoundingClientRect();
      if (x > s.left - o.left - pad && x < s.right - o.left + pad && y > s.top - o.top - pad && y < s.bottom - o.top + pad) return true;
    }
    return false;
  }

  private bindPointer() {
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      const p = this.local(e);
      const v = this.vel.sample(e.clientX, e.clientY);
      this.vx = v.vx;
      this.lastMoveAt = performance.now();
      if (!this.inside(p.x, p.y)) {
        if (this.engaged && !this.leaveT) this.leaveT = window.setTimeout(() => { this.leaveT = 0; this.release(); }, LEAVE_MS);
        return;
      }
      if (this.leaveT) { clearTimeout(this.leaveT); this.leaveT = 0; }
      this.engaged = true;
      this.track(p.x, p.y, v.vx);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    const offWin = () => window.removeEventListener("pointermove", onMove);
    this.cleanup.push(offWin);

    // hovering the stage itself keeps the focus where it is
    const hit = this.root;
    const zone = (t: EventTarget | null) => t instanceof Node && (this.hit.contains(t) || this.bayLayer.contains(t));
    hit.addEventListener("pointerdown", (e) => {
      if (!zone(e.target)) return;
      const p = this.local(e);
      if (e.pointerType === "touch") {
        (e.target as Element).setPointerCapture?.(e.pointerId);
        this.touch = { id: e.pointerId, x0: p.x, y0: p.y, moved: false, long: false };
        this.engaged = true;
        const i = this.restIndex(p.x);
        this.setFocus(i, 0);
        this.bays[i]?.icon?.setPress(true);
        clearTimeout(this.longT);
        this.longT = window.setTimeout(() => {
          if (!this.touch || this.focus < 0) return;
          const item = this.bays[this.focus].item;
          if (!item.stage) return;
          this.touch.long = true;
          this.stickyStage = true;
          this.setStaged(item.id);
          this.bays[this.focus].icon?.setPress(false);
          try { navigator.vibrate?.(8); } catch { /* not all devices */ }
        }, LONG_MS);
      } else {
        const i = this.focus >= 0 ? this.focus : this.restIndex(p.x);
        this.bays[i]?.icon?.setPress(true);
        const up = () => { this.bays[i]?.icon?.setPress(false); window.removeEventListener("pointerup", up); };
        window.addEventListener("pointerup", up);
      }
    });
    hit.addEventListener("pointermove", (e) => {
      if (!this.touch || e.pointerId !== this.touch.id) return;
      const p = this.local(e);
      const v = this.vel.sample(e.clientX, e.clientY);
      this.vx = v.vx;
      if (!this.touch.moved && Math.hypot(p.x - this.touch.x0, p.y - this.touch.y0) > 8) {
        this.touch.moved = true;
        if (!this.touch.long) clearTimeout(this.longT);
        for (const b of this.bays) b.icon?.setPress(false);
      }
      const c = this.capBox();
      if (this.staged && p.y < c.y0 - 4) {
        // finger slid up into the open stage: light the action under it
        const el = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-stage-action]") ?? null;
        if (el !== this.hotEl) { this.hotEl?.classList.remove("is-hot"); el?.classList.add("is-hot"); this.hotEl = el; }
        return;
      }
      if (this.hotEl) { this.hotEl.classList.remove("is-hot"); this.hotEl = null; }
      this.track(p.x, p.y, v.vx);
    });
    const endTouch = (e: PointerEvent, cancel: boolean) => {
      if (!this.touch || e.pointerId !== this.touch.id) return;
      const t = this.touch;
      this.touch = null;
      this.lastTouch = performance.now();
      clearTimeout(this.longT);
      for (const b of this.bays) b.icon?.setPress(false);
      const hot = this.hotEl as HTMLElement | null;
      if (hot) { hot.classList.remove("is-hot"); this.hotEl = null; }
      if (cancel) { this.release(); return; }
      if (hot) { hot.click(); this.closeStage(); this.release(); return; }
      if (t.long && !t.moved) { this.engaged = false; return; } // long-press: the stage stays until a tap elsewhere
      const p = this.local(e);
      if (this.hoverSat && this.cfg.satellite) { this.hoverSat = false; this.cb.onSearch(true); this.release(); return; }
      const c = this.capBox();
      if (p.y > c.y0 - 16 && this.focus >= 0) this.enter(this.focus);
      this.release();
    };
    hit.addEventListener("pointerup", (e) => endTouch(e, false));
    hit.addEventListener("pointercancel", (e) => endTouch(e, true));

    // the satellite lens
    this.satHit.addEventListener("click", (e) => {
      if (this.cfg.searchOpen) { if (e.target !== this.input) this.input.focus(); return; }
      this.cb.onSearch(true);
    });
    this.input.addEventListener("input", () => this.cb.onQuery?.(this.input.value));
    this.input.addEventListener("keydown", (e) => { if (e.key === "Escape") this.cb.onSearch(false); });

    // a tap outside closes a sticky stage
    const outside = (e: PointerEvent) => {
      if (!this.staged && !this.cfg.searchOpen) return;
      const t = e.target as Node;
      if (this.root.contains(t) && (this.stageHost.contains(t) || this.hit.contains(t) || this.bayLayer.contains(t) || this.satHit.contains(t) || this.satStageHost.contains(t))) return;
      if (this.cfg.pinStage) return;
      if (this.staged) { this.stickyStage = false; this.setStaged(null); this.setFocus(-1, 0); }
    };
    window.addEventListener("pointerdown", outside, true);
    this.cleanup.push(() => window.removeEventListener("pointerdown", outside, true));
  }
  private cleanup: (() => void)[] = [];

  /** pointer at (x, y) inside the dock: exit-only switching + the satellite's pull */
  private track(x: number, y: number, vx: number) {
    if (this.cfg.searchOpen) return;
    const c = this.capBox();
    const m = METRIC[this.cfg.size];
    // over the satellite (or reaching for it past the capsule's end)
    if (this.cfg.satellite && x > c.x1 + 2) {
      if (!this.hoverSat) { this.hoverSat = true; this.satIcon?.setHover(true, vx); }
      this.setFocus(-1, vx);
      clock.wake();
      return;
    }
    if (this.hoverSat) { this.hoverSat = false; this.satIcon?.setHover(false, vx); }
    // the open stage holds the focus while the pointer is above the capsule
    if (this.staged && y < c.y0 - 2) return;
    const ext = this.focusTargetExtent();
    if (ext && x >= ext[0] - 1 && x <= ext[1] + 1) return; // still inside the grown focus: keep it
    const i = this.restIndex(clamp(x, c.x0 + m.pad, c.x1 - m.pad - 0.5));
    if (i !== this.focus) this.setFocus(i, vx);
  }

  /* ------------------------------------------------------------------ frame */

  private tick(dt: number): boolean {
    const m = METRIC[this.cfg.size];
    let wsum = 0;
    for (const b of this.bays) wsum += b.w.t * 7 + b.w.x * 3 + (b.leaving ? 1 : 0);
    const sig = [this.cfg, this.bays, this.active, this.focus, this.staged, this.width, this.height, this.hoverSat, clock.intensity, wsum, this.search.t, this.sat.t];
    if (!this.lastMoving && sig.length === this.lastSig.length && sig.every((v, i) => v === this.lastSig[i])) return false;
    this.lastSig = sig;
    const moving = this.frame(dt, m);
    this.lastMoving = moving;
    return moving;
  }

  private frame(dt: number, m: typeof METRIC.phone): boolean {
    let moving = false;
    this.syncActive();
    // the layer's height: tall only while a stage or the search results are (or are still) out
    const tall = !!this.staged || this.cfg.searchOpen || this.stH.x > m.swellH + 3 || this.resH.x > 0.5 || this.stageHost.classList.contains("was-open");
    if (tall !== this.tall || !this.height) {
      this.tall = tall;
      this.height = tall ? 560 : m.bottom + m.H + m.swellH + 44;
      this.root.style.height = `${this.height}px`;
      this.lastPath = "";
    }
    for (const b of this.bays) if (stepS(b.w, dt)) moving = true;
    // drop bays that finished leaving
    if (this.bays.some((b) => b.leaving && b.w.x < 0.4 && b.w.t === 0)) {
      for (const b of this.bays) if (b.leaving && b.w.x < 0.4) { b.icon?.destroy(); b.el.remove(); }
      this.bays = this.bays.filter((b) => !(b.leaving && b.w.x < 0.4));
      if (this.focus >= this.bays.length) this.focus = -1;
      this.layoutTargets();
    }

    const H = this.height;
    const cy = H - m.bottom - m.H / 2;
    // positions from the current widths
    const total = this.bays.reduce((a, b) => a + Math.max(0, b.w.x), 0) + 2 * m.pad;
    const capL = this.capLeftFor(total);
    let x = capL + m.pad;
    for (const b of this.bays) { b.x = x; b.cw = Math.max(0, b.w.x); x += b.cw; }
    const cap: Box = { x0: capL, x1: capL + total, y0: cy - m.H / 2, y1: cy + m.H / 2, R: m.H / 2 };

    // the plate: under the focus, else home under the active bay
    const act = this.active;
    const ai = this.bays.findIndex((b) => b.item.id === act && !b.leaving);
    const pi = this.focus >= 0 ? this.focus : ai;
    if (pi >= 0) {
      const pb = this.bays[pi];
      this.plateX.t = pb.x + pb.cw / 2;
      this.plateW.t = pb.cw;
    }
    this.plateShown.t = pi >= 0 && !this.cfg.searchOpen ? 1 : 0;
    if (ai >= 0) this.dotX.t = this.bays[ai].x + this.bays[ai].cw / 2;
    for (const s of [this.plateX, this.plateW, this.dotX, this.plateShown]) if (stepS(s, dt)) moving = true;

    // stage / swell targets
    const sp = this.search.x;
    const vw = this.width;
    const stagedBay = this.staged ? this.bays.find((b) => b.item.id === this.staged) : null;
    if (stagedBay && stagedBay.item.stage) {
      const st = stagedBay.item.stage;
      const w = Math.min(st.w, vw - 2 * m.margin);
      this.stW.t = w;
      this.stH.t = st.h;
      this.stCx.t = clamp(stagedBay.x + stagedBay.cw / 2, m.margin + w / 2, vw - m.margin - w / 2);
      this.stR.t = 22; this.stF.t = 16;
    } else if (this.focus >= 0 && !this.cfg.searchOpen) {
      const fb = this.bays[this.focus];
      this.stW.t = Math.max(18, fb.w.t * 0.66);
      this.stH.t = m.swellH * clock.intensity;
      this.stCx.t = fb.x + fb.cw / 2;
      this.stR.t = 10; this.stF.t = 14;
    } else {
      this.stH.t = 0;
      this.stR.t = 10; this.stF.t = 14;
    }
    if (this.stH.x < 0.05 && this.stH.t > 0) {
      // growing from nothing: start where it should, not where it last was
      settle(this.stCx, this.stCx.t);
      settle(this.stW, Math.max(16, this.stW.t * 0.6));
    }
    for (const s of [this.stCx, this.stW, this.stH, this.stR, this.stF, this.search, this.sat, this.neck, this.resH]) if (stepS(s, dt)) moving = true;

    const sh = Math.max(0, this.stH.x);
    const stage: Box = { x0: this.stCx.x - this.stW.x / 2, x1: this.stCx.x + this.stW.x / 2, y0: cap.y0 - sh, y1: cap.y0, R: Math.max(0, this.stR.x) };
    let d = stack(stage, cap, Math.max(0, this.stF.x), "up");

    // satellite + neck
    const satP = clamp(this.sat.x, 0, 1);
    let satBox: Box | null = null;
    if (this.cfg.satellite || satP > 0.01) {
      const r = (m.H / 2) * satP;
      const sx0 = cap.x1 + m.gap + (m.H / 2 - r);
      const sx1 = lerp(sx0 + 2 * r, vw - m.margin, clamp(sp, 0, 1));
      satBox = { x0: sx0, x1: Math.max(sx0 + 2 * r, sx1), y0: cy - r, y1: cy + r, R: r };
      const resTarget = this.cfg.searchOpen && this.cfg.searchStage ? this.cfg.searchStage.h : 0;
      this.resH.t = resTarget;
      if (r > 0.5) {
        const rh = Math.max(0, this.resH.x);
        if (rh > 0.3) {
          // the field grows straight up into its results: same width, one surface
          const rw = satBox.x1 - satBox.x0;
          const rx0 = satBox.x0;
          // the results grow from the search field's own top edge
          const resBox: Box = { x0: rx0, x1: rx0 + rw, y0: satBox.y0 - rh - 0, y1: satBox.y0, R: 22 };
          d += stack(resBox, satBox, 16, "up");
          this.placeStage(this.satStageHost, this.satStageInner, resBox, { w: rw, h: this.cfg.searchStage!.h }, rh / Math.max(1, resTarget || rh));
        } else {
          d += rrectPath(satBox.x0, satBox.y0, satBox.x1, satBox.y1, satBox.R);
          this.satStageHost.style.visibility = "hidden";
        }
        // the neck: reaching for the lens, or holding the two together while searching
        this.neck.t = this.cfg.searchOpen ? 0.62 : this.hoverSat ? 1 : this.focus >= 0 && this.focus === this.lastLive() ? 0.32 : 0;
        const nb = clamp(this.neck.x, 0, 1) * satP;
        if (nb > 0.02) d += neckPath(cap.x1 - m.H / 2, m.H / 2, satBox.x0 + r, r, cy, nb);
      }
    }

    if (d !== this.lastPath) {
      this.lastPath = d;
      this.pBody.setAttribute("d", d);
      this.pEdge.setAttribute("d", d);
      this.pRim.setAttribute("d", d);
      for (const mp of this.maskPaths) mp.setAttribute("d", d);
      this.glass.style.clipPath = `path('${d}')`;
    }

    // bays
    for (const b of this.bays) {
      const extra = Math.max(0, b.cw - this.baseW(b.item));
      const lw = b.item.text !== undefined ? 0 : clamp(extra - 4, 0, b.labelW + 2);
      b.el.style.transform = `translate3d(${(b.x).toFixed(2)}px, ${(cap.y0).toFixed(2)}px, 0)`;
      b.el.style.width = `${b.cw.toFixed(2)}px`;
      b.el.style.height = `${m.H}px`;
      b.labWrap.style.width = `${lw.toFixed(2)}px`;
      const op = b.leaving ? clamp(b.cw / 30, 0, 1) : this.cfg.searchOpen && b.item.id !== act ? clamp(b.cw / 30, 0, 1) : 1;
      b.el.style.opacity = op.toFixed(3);
      b.lab.style.opacity = clamp((lw - 4) / Math.max(6, b.labelW - 4), 0, 1).toFixed(3);
      b.el.classList.toggle("is-active", b.item.id === act);
      b.el.classList.toggle("is-focus", this.bays[this.focus] === b);
    }

    // plate with a velocity stretch (volume kept: wider is flatter)
    const stretch = clamp(Math.abs(this.plateX.v) * 0.016, 0, 16) * clock.intensity;
    const pw = Math.max(0, this.plateW.x - 8 + stretch);
    const ph = m.H - 10 - stretch * 0.22;
    this.plate.style.transform = `translate3d(${(this.plateX.x - pw / 2).toFixed(2)}px, ${(cy - ph / 2).toFixed(2)}px, 0)`;
    this.plate.style.width = `${pw.toFixed(2)}px`;
    this.plate.style.height = `${ph.toFixed(2)}px`;
    this.plate.style.opacity = clamp(this.plateShown.x, 0, 1).toFixed(3);

    // datum + its single lit mark
    const dy = cap.y1 - 7.5;
    const dvx = clamp(Math.abs(this.dotX.v) * 0.02, 0, 14) * clock.intensity;
    this.dot.style.transform = `translate3d(${(this.dotX.x - 2 - dvx / 2).toFixed(2)}px, ${(dy - 2).toFixed(2)}px, 0)`;
    this.dot.style.width = `${(4 + dvx).toFixed(2)}px`;
    this.dot.style.opacity = (ai >= 0 && !this.cfg.searchOpen ? 1 - clamp(sp * 2, 0, 1) : 0).toFixed(3);
    const dx0 = cap.x0 + 20, dx1 = cap.x1 - 20;
    if (dx1 - dx0 > 20) {
      // the datum bows a hair toward the focus (attraction, not decoration)
      const fx = this.focus >= 0 ? this.bays[this.focus].x + this.bays[this.focus].cw / 2 : (dx0 + dx1) / 2;
      const bow = this.focus >= 0 ? -1.1 * clock.intensity : 0;
      this.pDatum.setAttribute("d", `M${dx0.toFixed(1)} ${dy}C${((dx0 + fx) / 2).toFixed(1)} ${dy} ${(fx - 14).toFixed(1)} ${(dy + bow).toFixed(1)} ${fx.toFixed(1)} ${(dy + bow).toFixed(1)}S${((fx + dx1) / 2).toFixed(1)} ${dy} ${dx1.toFixed(1)} ${dy}`);
      this.pDatum.style.opacity = (1 - clamp(sp * 2, 0, 1)).toFixed(3);
      this.datumGrad.setAttribute("x1", dx0.toFixed(1));
      this.datumGrad.setAttribute("x2", dx1.toFixed(1));
    } else this.pDatum.style.opacity = "0";
    // the crease: where the stage folds out of the capsule
    const q = stagedBay?.item.stage ? clamp(sh / stagedBay.item.stage.h, 0, 1) : clamp(sh / 60, 0, 1);
    if (sh > 12) {
      const c0 = Math.max(cap.x0 + 22, stage.x0 + 18), c1 = Math.min(cap.x1 - 22, stage.x1 - 18);
      this.pCrease.setAttribute("d", `M${c0.toFixed(1)} ${(cap.y0 + 0.5).toFixed(1)}H${c1.toFixed(1)}`);
      this.pCrease.style.opacity = (q * 0.9).toFixed(3);
      this.creaseGrad.setAttribute("x1", c0.toFixed(1));
      this.creaseGrad.setAttribute("x2", c1.toFixed(1));
    } else this.pCrease.style.opacity = "0";

    // the stage's content rides inside the contour, revealed from the crease up
    if (stagedBay?.item.stage) this.placeStage(this.stageHost, this.stageInner, stage, stagedBay.item.stage, q);
    else if (sh > 8 && this.stageHost.classList.contains("was-open")) this.placeStage(this.stageHost, this.stageInner, stage, this.lastStageSize, q);
    else this.stageHost.style.visibility = "hidden";
    if (stagedBay?.item.stage) { this.lastStageSize = stagedBay.item.stage; this.stageHost.classList.add("was-open"); }
    else if (sh <= 8) this.stageHost.classList.remove("was-open");

    // satellite button + search field
    if (satBox) {
      const r = satBox.R;
      this.satHit.style.transform = `translate3d(${satBox.x0.toFixed(2)}px, ${satBox.y0.toFixed(2)}px, 0)`;
      this.satHit.style.width = `${(satBox.x1 - satBox.x0).toFixed(2)}px`;
      this.satHit.style.height = `${(2 * r).toFixed(2)}px`;
      this.satHit.style.opacity = clamp(satP * 1.4 - 0.2, 0, 1).toFixed(3);
      this.input.style.opacity = clamp((sp - 0.45) * 2.2, 0, 1).toFixed(3);
      this.input.style.pointerEvents = sp > 0.6 ? "auto" : "none";
    }

    // the hit area follows the capsule
    this.hit.style.transform = `translate3d(${(cap.x0 - 6).toFixed(2)}px, ${(cap.y0 - 6).toFixed(2)}px, 0)`;
    this.hit.style.width = `${(cap.x1 - cap.x0 + 12).toFixed(2)}px`;
    this.hit.style.height = `${(m.H + 12).toFixed(2)}px`;

    return moving;
  }
  private lastStageSize = { w: 0, h: 0 };

  private lastLive() {
    for (let i = this.bays.length - 1; i >= 0; i--) if (!this.bays[i].leaving) return i;
    return -1;
  }

  private placeStage(host: HTMLDivElement, inner: HTMLDivElement, box: Box, size: { w: number; h: number }, q: number) {
    const w = box.x1 - box.x0, h = box.y1 - box.y0;
    host.style.visibility = h > 6 ? "visible" : "hidden";
    host.style.transform = `translate3d(${box.x0.toFixed(2)}px, ${box.y0.toFixed(2)}px, 0)`;
    host.style.width = `${w.toFixed(2)}px`;
    host.style.height = `${h.toFixed(2)}px`;
    const iw = Math.min(size.w, this.width - 2 * METRIC[this.cfg.size].margin);
    inner.style.width = `${iw}px`;
    inner.style.height = `${size.h}px`;
    inner.style.transform = `translate3d(${((w - iw) / 2).toFixed(2)}px, ${(h - size.h).toFixed(2)}px, 0)`;
    inner.style.setProperty("--q", clamp(q, 0, 1).toFixed(3));
  }

  /** debugging / bench hooks */
  get state() {
    return { focus: this.focus, staged: this.staged, widths: this.bays.map((b) => Math.round(b.cw * 10) / 10), search: this.cfg.searchOpen };
  }
  /** scripted input for the acceptance bench: drive the dock as if a pointer were at (x, y) */
  pointerAt(x: number | null, y?: number, vx = 0) {
    if (x === null) { this.release(); return; }
    this.engaged = true;
    this.vel.sample(x, y ?? 0);
    this.vx = vx;
    this.track(x, y ?? this.capBox().y0 + 20, vx);
  }

  destroy() {
    this.offTick();
    this.ro?.disconnect();
    for (const f of this.cleanup) f();
    for (const b of this.bays) b.icon?.destroy();
    this.satIcon?.destroy();
    clearTimeout(this.dwellT); clearTimeout(this.longT); clearTimeout(this.leaveT);
    this.root.remove();
  }
}
