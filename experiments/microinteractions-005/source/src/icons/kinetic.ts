/**
 * HAIZ 005 · 动态线稿图标 (kinetic line icons)
 *
 * Each icon is a small drawing that performs ONE clear, whole-silhouette change of geometry
 * before any click: the sun rises over the horizon, a page turns over the spine, the 榄仁's
 * tiers spread, the 1923 portico opens its doors. (Muse's grammar, studied frame by frame in
 * Experiment 004, redrawn here for HAIZ's destinations.)
 *
 * Channels, all springs on the one clock:
 *   m  morph     0 rest · .62 pass (hover) · 1 active · press dips it
 *   k  pulse     an underdamped impulse from the pointer's direction and speed
 *   l  lean      −1…1, given by the container when a neighbour takes the focus (让位)
 *   f  flip      accumulates ±π per entry for page / coin / leaf turns — never snaps back
 *   tw stagger   per-part tweens, delayed by distance (Hairline rule 02)
 *
 * Stroke hierarchy (Hairline rule 09): bright silhouette, dim inside. The only colour is the
 * lit dot of the active icon (rule 04).
 */
import { clamp, clock, lerp, spring, stepS, tween, tset, tval, tdone, type Spring, type Tween } from "../kernel/motion";

const NS = "http://www.w3.org/2000/svg";
type Attrs = Record<string, string | number>;
function mk<K extends keyof SVGElementTagNameMap>(tag: K, a: Attrs = {}, parent?: Element): SVGElementTagNameMap[K] {
  const n = document.createElementNS(NS, tag);
  for (const k in a) n.setAttribute(k, String(a[k]));
  if (parent) parent.appendChild(n);
  return n;
}
const set = (el: Element, a: Attrs) => { for (const k in a) el.setAttribute(k, String(a[k])); };
const f2 = (n: number) => (Math.round(n * 100) / 100).toString();
const tf = (el: Element, s: string) => el.setAttribute("transform", s);

export type IconKind =
  | "today" | "study" | "campus" | "me" | "lens" | "schedule" | "focus" | "lab" | "rings" | "tree"
  | "wander" | "bell" | "notes" | "notice" | "club" | "map" | "teacher" | "plus" | "settings"
  | "theme" | "growth" | "relay" | "playpause" | "stop" | "close" | "culture";

type St = { m: number; k: number; l: number; f: number; a: number; tw: (i: number) => number; v: number; now: number };
type Def = {
  flip?: boolean;
  tweens?: number;
  build: (g: SVGGElement, uid: string, svg: SVGSVGElement) => any;
  draw: (p: any, s: St) => void;
};

/* ---------- small geometry ---------- */
const bez = (p0: number[], p1: number[], p2: number[], p3: number[], t: number) => {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
};
const wob = (th: number) => 1 + 0.07 * Math.sin(2 * th + 0.6) + 0.04 * Math.sin(5 * th + 2.1) + 0.02 * Math.sin(9 * th + 4);
function ringD(cx: number, cy: number, r: number, n = 36, rot = 0) {
  let d = "";
  for (let i = 0; i <= n; i++) {
    const th = (i / n) * Math.PI * 2;
    const rr = r * wob(th + rot);
    d += (i ? "L" : "M") + f2(cx + rr * Math.sin(th)) + " " + f2(cy - rr * Math.cos(th));
  }
  return d + "Z";
}
const LEAF = "M14 19.2 C8.2 18.2 5.9 13.1 8.2 8.5 C10 5.1 12.6 4.5 14 4.5 C15.4 4.5 18 5.1 19.8 8.5 C22.1 13.1 19.8 18.2 14 19.2 Z";
const SMALL_LEAF = "M14 17 C11.7 15.5 11.4 11.6 12.6 9.5 C13.2 8.5 13.7 8 14 7.7 C14.3 8 14.8 8.5 15.4 9.5 C16.6 11.6 16.3 15.5 14 17 Z";
const drawLen = (el: SVGElement, len: number, p: number) => set(el, { "stroke-dasharray": f2(len), "stroke-dashoffset": f2(len * (1 - clamp(p, 0, 1))) });

/* ---------- the drawings ---------- */
const DEFS: Record<IconKind, Def> = {
  today: {
    tweens: 3,
    build(g, uid) {
      const defs = mk("defs", {}, g);
      const cp = mk("clipPath", { id: `kc${uid}` }, defs);
      mk("rect", { x: -2, y: -4, width: 32, height: 23.6 }, cp);
      const sky = mk("g", { "clip-path": `url(#kc${uid})` }, g);
      return {
        sun: mk("circle", { cx: 14, cy: 19.4, r: 4.7, class: "ki-pri" }, sky),
        rays: [0, 1, 2].map(() => mk("path", { class: "ki-fine" }, sky)),
        dot: mk("circle", { cx: 14, cy: 19.4, r: 1.15, class: "ki-dot" }, sky),
        hz: mk("path", { d: "M4.4 19.6 H23.6", class: "ki-pri" }, g),
        w1: mk("path", { d: "M8.6 22.9 H12.6", class: "ki-sub" }, g),
        w2: mk("path", { d: "M15.4 22.9 H19.4", class: "ki-sub" }, g),
        w3: mk("path", { d: "M11.2 25.2 H16.8", class: "ki-sub" }, g),
      };
    },
    draw(p, s) {
      const rise = clamp(s.m * 1.04 + s.k * 0.07, -0.2, 1.25);
      const cy = lerp(19.3, 14.4, Math.min(rise, 1)) - Math.max(0, rise - 1) * 2.4 + (s.a > 0.5 ? -0.4 : 0);
      set(p.sun, { cy: f2(cy) });
      set(p.dot, { cy: f2(cy), r: f2(0.9 + s.m * 0.45) });
      [-90, -140, -40].forEach((deg, i) => {
        const a = (deg * Math.PI) / 180, t = s.tw(i);
        const r0 = 6.4, r1 = 6.4 + 2.4 * t;
        set(p.rays[i], { d: `M${f2(14 + r0 * Math.cos(a))} ${f2(cy + r0 * Math.sin(a))}L${f2(14 + r1 * Math.cos(a))} ${f2(cy + r1 * Math.sin(a))}`, opacity: f2(t) });
      });
      const sh = 1 + s.k * 0.18;
      tf(p.w1, `translate(10.6 0) scale(${f2(sh)} 1) translate(-10.6 0)`);
      tf(p.w2, `translate(17.4 0) scale(${f2(2 - sh)} 1) translate(-17.4 0)`);
      set(p.w3, { opacity: f2(0.6 + s.m * 0.4) });
    },
  },

  study: {
    flip: true, tweens: 2,
    build(g) {
      mk("path", { d: "M14 9.2 C11.6 7.6 8.2 7.4 5.2 8.4 V20.6 C8.2 19.6 11.6 19.8 14 21.4", class: "ki-pri" }, g);
      mk("path", { d: "M14 9.2 C16.4 7.6 19.8 7.4 22.8 8.4 V20.6 C19.8 19.6 16.4 19.8 14 21.4", class: "ki-pri" }, g);
      const l1 = mk("path", { d: "M16.5 12.3 H20.3", class: "ki-fine" }, g);
      const l2 = mk("path", { d: "M16.5 15.2 H19.4", class: "ki-fine" }, g);
      const dot = mk("circle", { cx: 19.4, cy: 18.1, r: 1.1, class: "ki-dot" }, g);
      const leaf = mk("path", { d: "M14 9.2 C16.4 7.6 19.8 7.4 22.8 8.4 V20.6 C19.8 19.6 16.4 19.8 14 21.4 Z", class: "ki-sec ki-plate" }, g);
      mk("path", { d: "M14 9.2 V21.4", class: "ki-sec" }, g);
      return { l1, l2, dot, leaf };
    },
    draw(p, s) {
      const c = Math.cos(s.f), sn = Math.sin(s.f);
      const sx = Math.abs(c) < 0.06 ? 0.06 * Math.sign(c || 1) : c;
      tf(p.leaf, `translate(14 15.3) skewY(${f2(-sn * 9)}) scale(${f2(sx)} ${f2(1 - Math.abs(sn) * 0.06)}) translate(-14 -15.3)`);
      set(p.leaf, { opacity: f2(0.35 + 0.65 * Math.abs(sn) + (s.m > 0.9 ? 0 : 0)) });
      drawLen(p.l1, 3.8, 0.25 + s.tw(0) * 0.75);
      drawLen(p.l2, 2.9, 0.25 + s.tw(1) * 0.75);
      set(p.dot, { r: f2(0.85 + s.m * 0.4) });
    },
  },

  campus: {
    build(g) {
      mk("path", { d: "M4.5 22.6 H23.5", class: "ki-sub" }, g);
      mk("path", { d: "M7.3 22.6 V12.6 M20.7 22.6 V12.6", class: "ki-pri" }, g);
      const doorL = mk("path", { d: "M10.5 22.6 V15.2 H14 V22.6", class: "ki-sec" }, g);
      const doorR = mk("path", { d: "M17.5 22.6 V15.2 H14 V22.6", class: "ki-sec" }, g);
      const roof = mk("g", {}, g);
      mk("path", { d: "M4.8 12.7 L14 6.7 L23.2 12.7", class: "ki-pri" }, roof);
      mk("path", { d: "M9.7 9.7 L14 6.9 L18.3 9.7", class: "ki-fine" }, roof);
      const dot = mk("circle", { cx: 14, cy: 18.6, r: 1.3, class: "ki-dot" }, g);
      return { doorL, doorR, roof, dot };
    },
    draw(p, s) {
      tf(p.roof, `translate(0 ${f2(-s.m * 2.4 - Math.abs(s.k) * 0.6)}) rotate(${f2(s.k * 6.5)} 14 9)`);
      const open = clamp(s.m * 1.1 + Math.abs(s.k) * 0.22, 0, 1);
      const sx = Math.max(0.16, 1 - open * 0.76);
      tf(p.doorL, `translate(10.5 0) scale(${f2(sx)} 1) translate(-10.5 0)`);
      tf(p.doorR, `translate(17.5 0) scale(${f2(sx)} 1) translate(-17.5 0)`);
      set(p.dot, { cy: f2(18.8 - open * 2.2), r: f2(0.8 + open * 0.8) });
    },
  },

  me: {
    flip: true, tweens: 2,
    build(g) {
      const tw = mk("g", {}, g);
      mk("path", { d: "M14 23.4 V17.4", class: "ki-pri" }, tw);
      mk("path", { d: LEAF, class: "ki-pri ki-plate" }, tw);
      mk("path", { d: "M14 18.8 V7.2", class: "ki-sec" }, tw);
      const vL = mk("path", { d: "M14 14.6 L10.3 11.5 M14 11.1 L11.2 8.8", class: "ki-fine" }, tw);
      const vR = mk("path", { d: "M14 14.6 L17.7 11.5 M14 11.1 L16.8 8.8", class: "ki-fine" }, tw);
      const dot = mk("circle", { cx: 14, cy: 12.2, r: 1.25, class: "ki-dot" }, tw);
      return { tw, vL, vR, dot };
    },
    draw(p, s) {
      const sx = Math.max(0.2, Math.abs(Math.cos(s.f)));
      tf(p.tw, `translate(14 21) rotate(${f2(s.k * 10)}) scale(${f2(sx)} 1) translate(-14 -21)`);
      drawLen(p.vL, 10, s.tw(0));
      drawLen(p.vR, 10, s.tw(1));
      set(p.dot, { r: f2(0.8 + s.m * 0.6) });
    },
  },

  lens: {
    flip: true,
    build(g) {
      const fg = mk("g", {}, g);
      mk("circle", { cx: 12.4, cy: 12.4, r: 6.5, class: "ki-pri" }, fg);
      const glint = mk("path", { d: "M9.4 11.2 A3.6 3.6 0 0 1 13.6 8.9", class: "ki-fine" }, fg);
      mk("path", { d: "M17.3 17.3 L22.5 22.5", class: "ki-pri" }, fg);
      const dot = mk("circle", { cx: 12.4, cy: 12.4, r: 1.25, class: "ki-dot" }, fg);
      return { fg, glint, dot };
    },
    draw(p, s) {
      const sx = Math.max(0.12, Math.abs(Math.cos(s.f)));
      tf(p.fg, `translate(14 14) rotate(-45) scale(${f2(sx)} 1) rotate(${f2(45 + s.k * 8)}) translate(-14 -14)`);
      set(p.glint, { opacity: f2(0.35 + s.m * 0.65) });
      set(p.dot, { r: f2(0.75 + s.m * 0.7) });
    },
  },

  schedule: {
    flip: true,
    build(g) {
      mk("rect", { x: 6.2, y: 8.2, width: 15.6, height: 14.2, rx: 2.6, class: "ki-sub" }, g);
      const sheet = mk("g", {}, g);
      mk("rect", { x: 6.2, y: 8.2, width: 15.6, height: 14.2, rx: 2.6, class: "ki-pri ki-plate" }, sheet);
      mk("path", { d: "M6.2 12.2 H21.8", class: "ki-sec" }, sheet);
      const dots = [[10, 15.6], [14, 15.6], [18, 15.6], [10, 19], [14, 19], [18, 19]].map(([x, y]) => mk("circle", { cx: x, cy: y, r: 0.8, class: "ki-fill-fine" }, sheet));
      const ring = mk("circle", { cx: 14, cy: 15.6, r: 2.1, class: "ki-sec" }, sheet);
      const dot = mk("circle", { cx: 14, cy: 15.6, r: 0.95, class: "ki-dot" }, sheet);
      mk("path", { d: "M10.2 6 V9.8 M17.8 6 V9.8", class: "ki-pri" }, g);
      return { sheet, ring, dot, dots };
    },
    draw(p, s) {
      const c = Math.cos(s.f), sn = Math.sin(s.f);
      tf(p.sheet, `translate(14 8.2) skewX(${f2(sn * 7)}) scale(1 ${f2(Math.max(0.12, Math.abs(c)))}) translate(-14 -8.2)`);
      const t = clamp(s.m, 0, 1), x = lerp(14, 18, t);
      set(p.ring, { cx: f2(x) });
      set(p.dot, { cx: f2(x), r: f2(0.8 + s.m * 0.35) });
    },
  },

  focus: {
    build(g) {
      mk("circle", { cx: 14, cy: 15.2, r: 8.2, class: "ki-sub" }, g);
      const arc = mk("circle", { cx: 14, cy: 15.2, r: 8.2, class: "ki-pri", transform: "rotate(-90 14 15.2)" }, g);
      const crown = mk("g", {}, g);
      mk("path", { d: "M12 4.6 H16", class: "ki-pri" }, crown);
      mk("path", { d: "M14 4.6 V7", class: "ki-sec" }, crown);
      const hand = mk("path", { class: "ki-sec" }, g);
      const dot = mk("circle", { cx: 14, cy: 15.2, r: 1.2, class: "ki-dot" }, g);
      return { arc, crown, hand, dot };
    },
    draw(p, s) {
      const C = 2 * Math.PI * 8.2;
      const prog = clamp(lerp(0.2, 0.84, s.m) + s.k * 0.05, 0.02, 1);
      set(p.arc, { "stroke-dasharray": f2(C), "stroke-dashoffset": f2(C * (1 - prog)) });
      const a = -Math.PI / 2 + prog * Math.PI * 2;
      set(p.hand, { d: `M14 15.2 L${f2(14 + 5 * Math.cos(a))} ${f2(15.2 + 5 * Math.sin(a))}` });
      tf(p.crown, `translate(0 ${f2(Math.max(0, -s.k) * 0.8)})`);
      set(p.dot, { r: f2(1 + s.m * 0.5) });
    },
  },

  lab: {
    build(g) {
      mk("path", { d: "M6.6 19.6 A9.2 9.2 0 0 0 21.4 19.6", class: "ki-sub" }, g);
      mk("path", { d: "M6.3 6.9 H21.7", class: "ki-pri" }, g);
      const arm = mk("g", {}, g);
      mk("path", { d: "M14 6.9 V17.2", class: "ki-pri" }, arm);
      mk("circle", { cx: 14, cy: 19.5, r: 2.8, class: "ki-pri ki-plate" }, arm);
      const dot = mk("circle", { cx: 14, cy: 19.5, r: 1, class: "ki-dot" }, arm);
      mk("circle", { cx: 14, cy: 6.9, r: 1.3, class: "ki-fill-pri" }, g);
      return { arm, dot };
    },
    draw(p, s) {
      tf(p.arm, `rotate(${f2(clamp(s.k * 27 + s.m * 5 * Math.sign(s.k || 1), -42, 42))} 14 6.9)`);
      set(p.dot, { r: f2(0.8 + s.m * 0.6) });
    },
  },

  rings: {
    tweens: 3,
    build(g) {
      const rs = [3.3, 6.5, 9.7].map((r) => mk("path", { d: ringD(14, 14, r), class: r > 9 ? "ki-pri" : "ki-sec" }, g));
      const crack = mk("path", { d: "M14 14 L21.4 7.8", class: "ki-fine" }, g);
      const bark = mk("path", { d: ringD(14, 14, 11.6, 48), class: "ki-fine" }, g);
      const dot = mk("circle", { cx: 14, cy: 14, r: 1.1, class: "ki-dot" }, g);
      return { rs, crack, bark, dot };
    },
    draw(p, s) {
      p.rs.forEach((el: SVGPathElement, i: number) => {
        const t = s.tw(i), sc = 1 + t * (0.05 + i * 0.012) + s.k * 0.02 * (i + 1);
        tf(el, `translate(14 14) rotate(${f2(s.k * (3 - i) * 2)}) scale(${f2(sc)}) translate(-14 -14)`);
      });
      drawLen(p.crack, 9.8, s.m);
      drawLen(p.bark, 76, s.tw(2) * 0.92);
      set(p.dot, { r: f2(0.85 + s.m * 0.5) });
    },
  },

  tree: {
    tweens: 3,
    build(g) {
      mk("path", { d: "M8.4 23.4 H19.6", class: "ki-sub" }, g);
      mk("path", { d: "M14 23.4 V8.6", class: "ki-pri" }, g);
      const t3 = mk("g", {}, g), t2 = mk("g", {}, g), t1 = mk("g", {}, g);
      mk("path", { d: "M14 19.6 L9.4 17.2 M14 19.6 L18.6 17.2", class: "ki-fine" }, t3);
      mk("path", { d: "M4.8 17.6 C9 16 19 16 23.2 17.6", class: "ki-pri" }, t3);
      mk("path", { d: "M14 15.1 L10.6 12.8 M14 15.1 L17.4 12.8", class: "ki-fine" }, t2);
      mk("path", { d: "M7.3 13.2 C10.6 11.9 17.4 11.9 20.7 13.2", class: "ki-pri" }, t2);
      mk("path", { d: "M10.3 9.1 C12 8.2 16 8.2 17.7 9.1", class: "ki-pri" }, t1);
      const dot = mk("circle", { cx: 14, cy: 8.4, r: 1.15, class: "ki-dot" }, g);
      return { tiers: [t1, t2, t3], dot };
    },
    draw(p, s) {
      p.tiers.forEach((el: SVGGElement, i: number) => {
        const t = s.tw(i), y = [9, 13, 17.4][i];
        const sx = 1 + t * (0.1 + i * 0.03);
        tf(el, `translate(14 ${y}) rotate(${f2(s.k * (2 + i * 1.6))}) scale(${f2(sx)} ${f2(1 - t * 0.08)}) translate(-14 ${-y}) translate(0 ${f2(-t * (0.5 + i * 0.25))})`);
      });
      set(p.dot, { r: f2(0.8 + s.m * 0.5) });
    },
  },

  wander: {
    build(g) {
      mk("path", { d: "M9.2 21.8 L7.8 24.8 M18.8 21.8 L20.2 24.8", class: "ki-fine" }, g);
      const fr = mk("g", {}, g);
      mk("rect", { x: 5.2, y: 6.4, width: 17.6, height: 15.2, rx: 2.4, class: "ki-pri ki-plate" }, fr);
      const path = mk("path", { d: "M8.4 19 C11 19 11.4 14.6 14 14.4 C16.6 14.2 17 9.6 19.6 9.6", class: "ki-sec" }, fr);
      const dot = mk("circle", { r: 1.2, class: "ki-dot" }, fr);
      return { fr, path, dot };
    },
    draw(p, s) {
      const t = clamp(s.m, 0, 1);
      tf(p.fr, `translate(14 14) skewY(${f2(-4 * t - s.k * 2)}) scale(${f2(1 - 0.06 * t)} 1) translate(-14 -14)`);
      drawLen(p.path, 17, 0.3 + 0.7 * t);
      const u = lerp(0.04, 0.96, t) * 0.5;
      const pt = u < 0.5 ? bez([8.4, 19], [11, 19], [11.4, 14.6], [14, 14.4], u * 2) : bez([14, 14.4], [16.6, 14.2], [17, 9.6], [19.6, 9.6], u * 2 - 1);
      const tt = lerp(0.04, 0.96, t);
      const q = tt < 0.5 ? bez([8.4, 19], [11, 19], [11.4, 14.6], [14, 14.4], tt * 2) : bez([14, 14.4], [16.6, 14.2], [17, 9.6], [19.6, 9.6], tt * 2 - 1);
      set(p.dot, { cx: f2(q[0]), cy: f2(q[1]) });
      void pt;
    },
  },

  bell: {
    build(g) {
      const body = mk("g", {}, g);
      mk("path", { d: "M9.2 18.6 C9.4 12.9 10.6 9.6 14 9.6 C17.4 9.6 18.6 12.9 18.8 18.6", class: "ki-pri" }, body);
      mk("path", { d: "M7.4 18.7 H20.6", class: "ki-pri" }, body);
      mk("path", { d: "M14 7.4 V9.6", class: "ki-sec" }, body);
      const clap = mk("g", {}, body);
      mk("path", { d: "M12.4 21.2 A1.6 1.6 0 0 0 15.6 21.2", class: "ki-sec" }, clap);
      const badge = mk("circle", { cx: 19.6, cy: 8.6, r: 2.1, class: "ki-badge" }, g);
      return { body, clap, badge };
    },
    draw(p, s) {
      tf(p.body, `rotate(${f2(s.k * 15)} 14 7.6)`);
      tf(p.clap, `translate(${f2(-s.k * 1.6 + s.l * 0.4)} 0)`);
    },
  },

  notes: {
    tweens: 3,
    build(g) {
      mk("path", { d: "M8 6.4 H17 L21 10.4 V21.6 H8 Z", class: "ki-pri ki-plate" }, g);
      const ear = mk("path", { class: "ki-sec" }, g);
      const ls = ["M10.6 13.6 H18.2", "M10.6 16.4 H17", "M10.6 19.2 H14.6"].map((d) => mk("path", { d, class: "ki-fine" }, g));
      const dot = mk("circle", { cx: 18.2, cy: 19.2, r: 1.05, class: "ki-dot" }, g);
      return { ear, ls, dot };
    },
    draw(p, s) {
      const e = 4 + s.m * 1.8 + s.k * 0.4;
      set(p.ear, { d: `M${f2(21 - e)} 6.4 V${f2(6.4 + e)} H21` });
      [7.6, 6.4, 4].forEach((len, i) => drawLen(p.ls[i], len, 0.3 + s.tw(i) * 0.7));
      set(p.dot, { r: f2(0.8 + s.m * 0.4) });
    },
  },

  notice: {
    tweens: 2,
    build(g) {
      const paper = mk("path", { class: "ki-pri ki-plate" }, g);
      const ls = ["M10.4 12.6 H17.6", "M10.4 15.2 H16.2"].map((d) => mk("path", { d, class: "ki-fine" }, g));
      const roll = mk("path", { class: "ki-sec" }, g);
      mk("rect", { x: 6.6, y: 5.8, width: 14.8, height: 3.2, rx: 1.6, class: "ki-pri ki-plate" }, g);
      const dot = mk("circle", { cx: 14, cy: 18, r: 1.05, class: "ki-dot" }, g);
      return { paper, ls, roll, dot };
    },
    draw(p, s) {
      const L = lerp(9.2, 13.2, clamp(s.m + s.k * 0.06, 0, 1.2));
      set(p.paper, { d: `M8.2 9 V${f2(9 + L)} H19.8 V9 Z` });
      set(p.roll, { d: `M7.2 ${f2(9 + L)} H20.8` });
      p.ls.forEach((el: SVGPathElement, i: number) => drawLen(el, 7.2, 0.25 + s.tw(i) * 0.75));
      set(p.dot, { cy: f2(9 + L - 2.6), r: f2(0.8 + s.m * 0.4) });
    },
  },

  club: {
    build(g) {
      mk("path", { d: "M14 23.4 V17", class: "ki-pri" }, g);
      const a = mk("g", {}, g), b = mk("g", {}, g);
      for (const grp of [a, b]) {
        mk("path", { d: SMALL_LEAF, class: "ki-pri ki-plate" }, grp);
        mk("path", { d: "M14 16.4 V9.6", class: "ki-fine" }, grp);
      }
      const dot = mk("circle", { cx: 14, cy: 17, r: 1.15, class: "ki-dot" }, g);
      return { a, b, dot };
    },
    draw(p, s) {
      const sp = 30 + s.m * 11, w = s.k * 7;
      tf(p.a, `rotate(${f2(-sp + w)} 14 17)`);
      tf(p.b, `rotate(${f2(sp + w)} 14 17)`);
      set(p.dot, { r: f2(0.85 + s.m * 0.45) });
    },
  },

  map: {
    build(g) {
      const out = mk("path", { class: "ki-pri ki-plate" }, g);
      const folds = mk("path", { class: "ki-sec" }, g);
      const dot = mk("circle", { r: 1.5, class: "ki-dot" }, g);
      const pin = mk("path", { class: "ki-sec" }, g);
      return { out, folds, dot, pin };
    },
    draw(p, s) {
      const t = clamp(s.m, 0, 1);
      const W = lerp(14.6, 17.4, t), d = lerp(2.8, 0.5, t), x0 = 14 - W / 2, top = 8.4, h = 12.4;
      const xs = [0, 1, 2, 3].map((i) => x0 + (W * i) / 3);
      const ys = [d, 0, d, 0];
      set(p.out, { d: `M${xs.map((x, i) => `${f2(x)} ${f2(top + ys[i])}`).join("L")}L${xs.slice().reverse().map((x, i) => `${f2(x)} ${f2(top + h + ys[3 - i])}`).join("L")}Z` });
      set(p.folds, { d: `M${f2(xs[1])} ${f2(top)}V${f2(top + h)}M${f2(xs[2])} ${f2(top + d)}V${f2(top + h + d)}` });
      const py = lerp(13.2, 14.2, t) - Math.abs(s.k) * 2.6;
      set(p.dot, { cx: 14, cy: f2(py - 2.2) });
      set(p.pin, { d: `M14 ${f2(py - 0.6)} V${f2(py + 1.6)}` });
    },
  },

  teacher: {
    build(g) {
      mk("path", { d: "M9.2 17.8 L7.8 23.4 M18.8 17.8 L20.2 23.4", class: "ki-sec" }, g);
      const board = mk("g", {}, g);
      mk("rect", { x: 5.4, y: 6.6, width: 17.2, height: 11.2, rx: 2, class: "ki-pri ki-plate" }, board);
      const chalk = mk("path", { d: "M8.6 13.8 C10 10.8 11.6 10.8 13 13.2 C14.4 15.6 16 15.6 17.4 12.8 L19.4 10.6", class: "ki-sec" }, board);
      const dot = mk("circle", { cx: 19.4, cy: 10.6, r: 1.05, class: "ki-dot" }, board);
      return { board, chalk, dot };
    },
    draw(p, s) {
      tf(p.board, `rotate(${f2(s.k * 2.5)} 14 17.8)`);
      drawLen(p.chalk, 16, 0.22 + s.m * 0.78);
      set(p.dot, { r: f2(0.8 + s.m * 0.4) });
    },
  },

  plus: {
    build(g) {
      const ring = mk("circle", { cx: 14, cy: 14, r: 9, class: "ki-fine", transform: "rotate(-90 14 14)" }, g);
      const cross = mk("path", { d: "M14 8.6 V19.4 M8.6 14 H19.4", class: "ki-pri" }, g);
      return { ring, cross };
    },
    draw(p, s) {
      tf(p.cross, `rotate(${f2(s.m * 90 + s.k * 12)} 14 14)`);
      drawLen(p.ring, 56.6, s.m);
    },
  },

  settings: {
    tweens: 3,
    build(g) {
      const ys = [8.6, 14, 19.4];
      ys.forEach((y) => mk("path", { d: `M5.6 ${y} H22.4`, class: "ki-sec" }, g));
      const ks = ys.map((y) => mk("circle", { cy: y, r: 2.2, class: "ki-pri ki-plate" }, g));
      return { ks };
    },
    draw(p, s) {
      const r0 = [17.4, 10, 15.4], r1 = [11, 17.6, 9.4];
      p.ks.forEach((el: SVGCircleElement, i: number) => set(el, { cx: f2(lerp(r0[i], r1[i], s.tw(i)) + s.k * (i - 1) * 0.6) }));
    },
  },

  theme: {
    build(g, uid) {
      const defs = mk("defs", {}, g);
      const mask = mk("mask", { id: `km${uid}` }, defs);
      mk("rect", { x: -2, y: -2, width: 32, height: 32, fill: "#fff" }, mask);
      const bite = mk("circle", { r: 5.4, fill: "#000" }, mask);
      const disc = mk("circle", { cx: 14, cy: 14, r: 5.4, class: "ki-pri", mask: `url(#km${uid})` }, g);
      const rays = Array.from({ length: 8 }, () => mk("path", { class: "ki-fine" }, g));
      return { bite, disc, rays };
    },
    draw(p, s) {
      const dark = clamp(s.v, 0, 1);
      set(p.bite, { cx: f2(lerp(24, 17.6, dark)), cy: f2(lerp(4, 10.6, dark)) });
      set(p.disc, { r: f2(lerp(4.6, 6.4, dark)) });
      p.rays.forEach((el: SVGPathElement, i: number) => {
        const a = (i / 8) * Math.PI * 2 + s.k * 0.2 + s.m * 0.4;
        const r0 = 7.4, r1 = 7.4 + 2.4 * (1 - dark) * (0.6 + s.m * 0.4);
        set(el, { d: `M${f2(14 + r0 * Math.cos(a))} ${f2(14 + r0 * Math.sin(a))}L${f2(14 + r1 * Math.cos(a))} ${f2(14 + r1 * Math.sin(a))}`, opacity: f2(1 - dark) });
      });
    },
  },

  growth: {
    build(g) {
      mk("path", { d: "M8 22.8 H20", class: "ki-sub" }, g);
      const stem = mk("path", { class: "ki-pri" }, g);
      const a = mk("path", { d: "M14 0 C11.4 -0.4 9.4 -2.4 9 -5 C11.6 -4.8 13.6 -2.8 14 0 Z", class: "ki-sec ki-plate" }, g);
      const b = mk("path", { d: "M14 0 C16.6 -0.4 18.6 -2.4 19 -5 C16.4 -4.8 14.4 -2.8 14 0 Z", class: "ki-sec ki-plate" }, g);
      const dot = mk("circle", { r: 1.05, class: "ki-dot" }, g);
      return { stem, a, b, dot };
    },
    draw(p, s) {
      const L = lerp(8.2, 11.6, clamp(s.m, 0, 1)) + s.k * 0.5, top = 22.8 - L;
      set(p.stem, { d: `M14 22.8 V${f2(top)}` });
      const o = lerp(0.6, 1.08, s.m);
      tf(p.a, `translate(0 ${f2(top + 3)}) rotate(${f2(-s.k * 6)} 14 0) scale(${f2(o)}) translate(${f2(14 / o - 14)} 0)`);
      tf(p.b, `translate(0 ${f2(top + 6)}) rotate(${f2(s.k * 6)} 14 0) scale(${f2(o)}) translate(${f2(14 / o - 14)} 0)`);
      set(p.dot, { cx: 14, cy: f2(top), r: f2(0.8 + s.m * 0.4) });
    },
  },

  relay: {
    build(g) {
      mk("circle", { cx: 8.6, cy: 18.6, r: 2.6, class: "ki-pri" }, g);
      mk("circle", { cx: 19.4, cy: 18.6, r: 2.6, class: "ki-pri" }, g);
      mk("path", { d: "M5.4 24 C6.2 22.4 7.2 21.8 8.6 21.8 C10 21.8 11 22.4 11.8 24 M16.2 24 C17 22.4 18 21.8 19.4 21.8 C20.8 21.8 21.8 22.4 22.6 24", class: "ki-sec" }, g);
      const arc = mk("path", { d: "M8.6 14.4 C10.4 8.4 17.6 8.4 19.4 14.4", class: "ki-fine" }, g);
      const dot = mk("circle", { r: 1.25, class: "ki-dot" }, g);
      return { arc, dot };
    },
    draw(p, s) {
      drawLen(p.arc, 15, 0.25 + s.m * 0.75);
      const q = bez([8.6, 14.4], [10.4, 8.4], [17.6, 8.4], [19.4, 14.4], clamp(s.m, 0, 1));
      set(p.dot, { cx: f2(q[0]), cy: f2(q[1]) });
    },
  },

  playpause: {
    build(g) {
      return { a: mk("path", { class: "ki-fill-pri" }, g), b: mk("path", { class: "ki-fill-pri" }, g) };
    },
    draw(p, s) {
      const t = clamp(s.v, 0, 1); // 0 pause · 1 play
      const A0 = [[9, 7.6], [12.6, 7.6], [12.6, 20.4], [9, 20.4]], A1 = [[9.6, 7.4], [15, 10.6], [15, 17.4], [9.6, 20.6]];
      const B0 = [[15.4, 7.6], [19, 7.6], [19, 20.4], [15.4, 20.4]], B1 = [[15, 10.6], [20.6, 14], [20.6, 14], [15, 17.4]];
      const path = (P0: number[][], P1: number[][]) => "M" + P0.map((q, i) => `${f2(lerp(q[0], P1[i][0], t))} ${f2(lerp(q[1], P1[i][1], t))}`).join("L") + "Z";
      set(p.a, { d: path(A0, A1) });
      set(p.b, { d: path(B0, B1) });
      tf(p.a, `translate(14 14) scale(${f2(1 - Math.abs(s.k) * 0.04)}) translate(-14 -14)`);
    },
  },

  stop: {
    build(g) { return { r: mk("rect", { x: 8.4, y: 8.4, width: 11.2, height: 11.2, rx: 2.6, class: "ki-pri" }, g) }; },
    draw(p, s) { tf(p.r, `translate(14 14) rotate(${f2(s.m * 45 + s.k * 8)}) scale(${f2(1 - s.m * 0.08)}) translate(-14 -14)`); },
  },

  close: {
    build(g) { return { x: mk("path", { d: "M9 9 L19 19 M19 9 L9 19", class: "ki-pri" }, g) }; },
    draw(p, s) { tf(p.x, `rotate(${f2(s.m * 90 + s.k * 10)} 14 14)`); },
  },

  culture: {
    tweens: 3,
    build(g) {
      const rs = [4.2, 7.6].map((r) => mk("path", { d: ringD(14, 14, r, 32, 1.1), class: "ki-sec" }, g));
      const leaf = mk("path", { d: SMALL_LEAF, class: "ki-pri ki-plate", transform: "translate(5 -2)" }, g);
      const dot = mk("circle", { cx: 14, cy: 14, r: 1.1, class: "ki-dot" }, g);
      return { rs, leaf, dot };
    },
    draw(p, s) {
      p.rs.forEach((el: SVGPathElement, i: number) => tf(el, `translate(14 14) scale(${f2(1 + s.tw(i) * 0.08)}) translate(-14 -14)`));
      tf(p.leaf, `translate(5 -2) rotate(${f2(20 + s.m * 18 + s.k * 8)} 14 17)`);
    },
  },
};

/* ---------- the instance ---------- */

let uidSeq = 0;
export type KineticIcon = {
  setHover(on: boolean, vx?: number): void;
  setPress(on: boolean): void;
  setActive(on: boolean): void;
  setLean(v: number): void;
  setVariant(v: number): void;
  impulse(vx: number): void;
  destroy(): void;
  el: SVGSVGElement;
};

export function mountIcon(host: HTMLElement, kind: IconKind, size = 24): KineticIcon {
  const def = DEFS[kind];
  const uid = (++uidSeq).toString(36);
  host.textContent = "";
  const svg = mk("svg", { viewBox: "0 0 28 28", width: size, height: size, class: `ki ki-${kind}`, "aria-hidden": "true", focusable: "false" });
  host.appendChild(svg);
  const root = mk("g", {}, svg);
  const parts = def.build(root, uid, svg);

  const m: Spring = spring(0, { k: 250, c: 22, eps: 0.0008 });
  const k: Spring = spring(0, { k: 135, c: 9.8, eps: 0.0008 });
  const l: Spring = spring(0, { k: 210, c: 19, eps: 0.0008 });
  const f: Spring = spring(0, { k: 150, c: 16.5, eps: 0.001 });
  const v: Spring = spring(0, { k: 220, c: 24, eps: 0.001 });
  const tws: Tween[] = Array.from({ length: def.tweens || 0 }, () => tween(0, 640));
  let hovered = false, pressed = false, active = false, phase = 0, lastDrawn = "", dirty = true;

  const st: St = { m: 0, k: 0, l: 0, f: 0, a: 0, v: 0, now: 0, tw: (i) => (tws[i] ? tval(tws[i], st.now) : st.m) };

  function target() {
    m.t = pressed ? (active ? 0.74 : 0.42) : active ? 1 : hovered ? 0.62 : 0;
    const on = hovered || active;
    const now = clock.now;
    tws.forEach((tw, i) => tset(tw, on ? 1 : 0, now, (on ? i : tws.length - 1 - i) * 55));
    dirty = true;
    clock.wake();
  }

  function render() {
    const I = clock.intensity;
    st.m = clamp(m.x, -0.2, 1.3);
    st.k = clamp(k.x, -2.2, 2.2) * I;
    st.l = clamp(l.x, -1.2, 1.2) * I;
    st.f = f.x; st.v = v.x; st.a = active ? 1 : 0; st.now = clock.now;
    const sc = 1 + st.m * 0.04 - (pressed ? 0.075 : 0);
    const t = `translate(14 14) translate(${f2(st.l * 1.5)} 0) rotate(${f2(st.l * 7)}) scale(${f2(sc)}) translate(-14 -14)`;
    if (t !== lastDrawn) { root.setAttribute("transform", t); lastDrawn = t; }
    def.draw(parts, st);
  }

  const off = clock.add((dt) => {
    let moving = false;
    if (stepS(m, dt)) moving = true;
    if (stepS(k, dt)) moving = true;
    if (stepS(l, dt)) moving = true;
    if (stepS(f, dt)) moving = true;
    if (stepS(v, dt)) moving = true;
    for (const tw of tws) if (!tdone(tw, clock.now)) moving = true;
    // draw only while something of ours moves, plus the frame where it lands (rule 07)
    if (moving || dirty) render();
    dirty = moving;
    return moving;
  });
  render();
  svg.classList.toggle("is-active", false);

  return {
    el: svg,
    setHover(on, vx = 0) {
      const entering = on && !hovered;
      hovered = on;
      if (entering) {
        const dir = Math.abs(vx) > 0.04 ? Math.sign(vx) : 1;
        const spd = clamp(Math.abs(vx) || 1.1, 0.75, 2.6);
        k.v += dir * spd * 7.6;
        if (def.flip) { phase += Math.PI * dir; f.t = phase; }
      } else if (!on && Math.abs(vx) > 0.08) {
        k.v += clamp(vx * 3.2, -6, 6);
      }
      target();
    },
    setPress(on) { pressed = on; if (on) k.v -= 2.4; target(); },
    setActive(on) {
      const changed = active !== on;
      active = on;
      svg.classList.toggle("is-active", on);
      if (changed && on) {
        k.v += 4.2;
        if (def.flip && !hovered) { phase += Math.PI; f.t = phase; }
      }
      target();
    },
    setLean(val) { l.t = clamp(val, -1, 1); dirty = true; clock.wake(); },
    setVariant(val) { v.t = val; k.v += 3; dirty = true; clock.wake(); },
    impulse(vx) { k.v += clamp(vx * 6.5, -10, 10); dirty = true; clock.wake(); },
    destroy() { off(); host.textContent = ""; },
  };
}

export const ICON_KINDS = Object.keys(DEFS) as IconKind[];
