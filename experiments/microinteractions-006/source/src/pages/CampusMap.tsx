/**
 * 校园 · 地图 — the real campus (34 footprints from the HAIZ campus model, after the school's
 * official plan), drawn in Hairline's isometric line grammar: every building a rounded prism,
 * silhouettes bright, insides dim, true painter's occlusion, no textures, no fake 3D.
 *
 * The pointer lifts the building under it, and its neighbours by distance (Hairline's falloff);
 * the lifted one gets the bright silhouette and a read-out. Drag sideways to turn the campus.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Cam, proj, fit, rrect, hull, ringAt, facing, run, open, poly, type Ring, type Sample, type Vec2, type Vec3 } from "../kernel/hairline-iso";
import { clock, spring, stepS, SP, clamp, falloff, type Spring } from "../kernel/motion";
import { useConst, useTick } from "../kernel/react";
import { setState } from "../app/store";

type B = { id: string; name: string; en: string; category: string; form: string; rect: number[]; size: number[]; rot: number; floors: number; poi: boolean; desc?: string; note?: string };
type Campus = { buildings: B[]; roads: { rect: number[] }[]; lawns: { rect: number[] }[]; fields: { rect: number[] }[]; water: { rect: number[] }[]; trees: { t: string; p: number[]; s: number }[] };

let campusCache: Campus | null = null;
export function useCampus() {
  const [c, setC] = useState<Campus | null>(campusCache);
  useEffect(() => {
    if (c) return;
    fetch(new URL("./data/campus.json", document.baseURI)).then((r) => r.json()).then((j) => { campusCache = j; setC(j); });
  }, [c]);
  return c;
}

const U = 6; // plan units per metre
const FLAT = new Set(["field", "botanic", "garden", "pond"]);
function ringOf(b: B): Ring {
  const [x0, y0, x1, y1] = b.rect;
  const cx = (x0 + x1) / 2 / U, cy = -(y0 + y1) / 2 / U, w = (x1 - x0) / U, d = (y1 - y0) / U;
  const r0 = rrect(-w / 2, -d / 2, w / 2, d / 2, Math.min(1.6, w / 4, d / 4), 3);
  const c = Math.cos(-b.rot || 0), s = Math.sin(-b.rot || 0);
  return r0.map((q: Sample) => ({ u: cx + q.u * c - q.v * s, v: cy + q.u * s + q.v * c, nu: q.nu * c - q.nv * s, nv: q.nu * s + q.nv * c }));
}
const inset = (ring: Ring, b: number): Ring => ring.map((q) => ({ u: q.u - q.nu * b, v: q.v - q.nv * b, nu: q.nu, nv: q.nv }));
const flatRect = (r: number[]): Vec2[] => [[r[0] / U, -r[1] / U], [r[2] / U, -r[1] / U], [r[2] / U, -r[3] / U], [r[0] / U, -r[3] / U]];

function inside(p: Vec2, pts: Vec2[]) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

export function CampusMap({ height = 560, focus, onHover }: { height?: number; focus?: string | null; onHover?: (id: string | null) => void }) {
  const campus = useCampus();
  const svg = useRef<SVGSVGElement>(null);
  const W = 1000, H = Math.round((1000 * height) / 640);
  const [hover, setHover] = useState<string | null>(null);
  const hov = focus ?? hover;
  const st = useConst(() => ({ az: spring(-28, { k: 90, c: 19 }), drag: false, x0: 0, az0: 0, moved: 0, lifts: new Map<string, Spring>(), order: [] as number[], hulls: [] as Vec2[][], ptr: [0, 0] as Vec2, ctr: [0, 0] as Vec2, anchor: [0, 0] as Vec2 }));

  const blds = useMemo(() => (campus ? campus.buildings.map((b, i) => ({ b, i, ring: ringOf(b), flat: FLAT.has(b.form) || b.size[1] < 1.5 })) : []), [campus]);
  const solids = useMemo(() => blds.filter((x) => !x.flat), [blds]);
  const flats = useMemo(() => blds.filter((x) => x.flat), [blds]);
  const els = useRef<{ g: SVGGElement; sil: SVGPathElement; cr: SVGPathElement; win: SVGPathElement }[]>([]);
  const flatEls = useRef<SVGPathElement[]>([]);
  const groundEls = useRef<SVGPathElement[]>([]);
  const treeEls = useRef<SVGEllipseElement[]>([]);
  const label = useRef<SVGGElement>(null);
  const labelT = useRef<SVGTextElement>(null);
  const labelS = useRef<SVGTextElement>(null);
  const labelL = useRef<SVGPathElement>(null);

  // fit once, at the default turn
  const cam = useConst(() => Cam(-28, 0.52, 1));
  const fitted = useRef(false);

  useEffect(() => { clock.wake(); }, [hov, campus]);

  useTick((dt) => {
    if (!campus || !svg.current) return false;
    let moving = stepS(st.az, dt);
    cam.az = (st.az.x * Math.PI) / 180;
    if (!fitted.current) {
      const pts: Vec3[] = [];
      for (const x of blds) for (const q of x.ring) pts.push([q.u, q.v, 0]);
      // scale so the campus fills the frame at this turn
      cam.S = 1;
      let P = proj(cam);
      let a = 1e9, bb = -1e9, c = 1e9, d = -1e9;
      for (const p of pts) { const q = P(p[0], p[1], p[2]); a = Math.min(a, q[0]); bb = Math.max(bb, q[0]); c = Math.min(c, q[1]); d = Math.max(d, q[1]); }
      cam.S = Math.min((W - 60) / (bb - a), (H - 90) / (d - c));
      fit(cam, pts, W / 2, H / 2 + 18);
      let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
      for (const p of pts) { u0 = Math.min(u0, p[0]); u1 = Math.max(u1, p[0]); v0 = Math.min(v0, p[1]); v1 = Math.max(v1, p[1]); }
      st.ctr = [(u0 + u1) / 2, (v0 + v1) / 2];
      st.anchor = proj(cam)(st.ctr[0], st.ctr[1], 0);
      fitted.current = true;
    } else {
      // keep the campus's centre where it was while it turns
      const P0 = proj({ ...cam, ox: 0, oy: 0 });
      const c0 = P0(st.ctr[0], st.ctr[1], 0);
      cam.ox = st.anchor[0] - c0[0]; cam.oy = st.anchor[1] - c0[1];
    }
    const P = proj(cam), front = facing(cam);
    const sdx = Math.sin(cam.az), sdy = Math.cos(cam.az);
    // lifts by Hairline's falloff from the hovered footprint
    const hb = hov ? solids.find((x) => x.b.id + x.i === hov) : null;
    const hc = hb ? [(hb.b.rect[0] + hb.b.rect[2]) / 2 / U, -(hb.b.rect[1] + hb.b.rect[3]) / 2 / U] : null;
    for (const x of solids) {
      const key = x.b.id + x.i;
      let s = st.lifts.get(key);
      if (!s) { s = spring(0, SP.lift); st.lifts.set(key, s); }
      if (hc) {
        const cx = (x.b.rect[0] + x.b.rect[2]) / 2 / U, cy = -(x.b.rect[1] + x.b.rect[3]) / 2 / U;
        const dist = Math.hypot(cx - hc[0], cy - hc[1]);
        s.t = key === hov ? 7 : 3.2 * falloff(dist / 160) - 0.3;
      } else s.t = 0;
      s.t *= clock.intensity;
      if (stepS(s, dt)) moving = true;
    }
    // ground
    const g = [...campus.fields, ...campus.lawns, ...campus.water, ...campus.roads];
    g.forEach((f, i) => { const el = groundEls.current[i]; if (el) el.setAttribute("d", poly(flatRect(f.rect).map((p) => P(p[0], p[1], 0)))); });
    flats.forEach((x, i) => { const el = flatEls.current[i]; if (el) el.setAttribute("d", poly(ringAt(P, x.ring, 0))); });
    campus.trees.forEach((t, i) => {
      const el = treeEls.current[i];
      if (!el) return;
      const q = P(t.p[0] / U, -t.p[1] / U, 5.5 * t.s);
      el.setAttribute("cx", q[0].toFixed(1)); el.setAttribute("cy", q[1].toFixed(1));
      el.setAttribute("rx", (2.6 * t.s * cam.S).toFixed(2)); el.setAttribute("ry", (2.6 * t.s * cam.S * cam.k).toFixed(2));
    });
    // painter's order: far to near along screen-down
    const order = solids.map((x, k) => ({ k, d: x.ring.reduce((a, q) => a + q.u * sdx + q.v * sdy, 0) / x.ring.length })).sort((a, b) => a.d - b.d).map((o) => o.k);
    st.order = order;
    const hulls: Vec2[][] = [];
    order.forEach((k, rank) => {
      const x = solids[k];
      const el = els.current[k];
      if (!el) return;
      const lift = st.lifts.get(x.b.id + x.i)!.x;
      const z0 = Math.max(0, lift), z1 = x.b.size[1] + Math.max(0, lift);
      const top = ringAt(P, x.ring, z1), bot = ringAt(P, x.ring, z0);
      const h = hull(top.concat(bot));
      hulls[k] = h;
      el.sil.setAttribute("d", poly(h));
      el.cr.setAttribute("d", open(ringAt(P, run(inset(x.ring, 0.9), front), z1)));
      // floor lines on the front faces: one hairline per storey, inside only (rule 09)
      let wd = "";
      const fr = run(x.ring, front);
      if (fr.length > 1 && x.b.floors > 1) {
        for (let f = 1; f < x.b.floors; f++) {
          const z = z0 + (x.b.size[1] * f) / x.b.floors;
          wd += open(ringAt(P, fr, z));
        }
      }
      el.win.setAttribute("d", wd);
      el.g.parentNode?.appendChild(el.g); // re-stack in painter's order
      void rank;
    });
    st.hulls = hulls;
    // read-out for the hovered building: a leader from its roof to a label
    if (label.current) {
      if (hb && hulls[solids.indexOf(hb)]) {
        const lift = st.lifts.get(hb.b.id + hb.i)!.x;
        const topc = P(hc![0], hc![1], hb.b.size[1] + lift);
        const lx = topc[0], ly = topc[1] - 34;
        labelL.current!.setAttribute("d", `M${topc[0].toFixed(1)} ${topc[1].toFixed(1)}V${(ly + 8).toFixed(1)}`);
        labelT.current!.setAttribute("x", lx.toFixed(1)); labelT.current!.setAttribute("y", (ly - 4).toFixed(1));
        labelS.current!.setAttribute("x", lx.toFixed(1)); labelS.current!.setAttribute("y", (ly + 11).toFixed(1));
        labelT.current!.textContent = hb.b.name;
        labelS.current!.textContent = `${hb.b.category}${hb.b.floors ? ` · ${hb.b.floors} 层` : ""} · ${hb.b.en}`;
        label.current.style.opacity = "1";
        label.current.parentNode?.appendChild(label.current);
      } else label.current.style.opacity = "0";
    }
    return moving;
  });

  const pick = (e: React.PointerEvent): string | null => {
    const r = svg.current!.getBoundingClientRect();
    const p: Vec2 = [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
    for (let i = st.order.length - 1; i >= 0; i--) {
      const k = st.order[i], h = st.hulls[k];
      if (h && inside(p, h)) return solids[k].b.id + solids[k].i;
    }
    return null;
  };

  if (!campus) return <div className="cmap cmap--wait" style={{ aspectRatio: `${W} / ${H}` }}>正在展开校园…</div>;
  return (
    <div className="cmap">
      <svg ref={svg} className="cmap-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="海南中学府城校区等距线稿地图"
        onPointerDown={(e) => { st.drag = true; st.x0 = e.clientX; st.az0 = st.az.t; st.moved = 0; (e.target as Element).setPointerCapture?.(e.pointerId); }}
        onPointerMove={(e) => {
          if (st.drag) {
            const dx = e.clientX - st.x0;
            st.moved = Math.max(st.moved, Math.abs(dx));
            if (st.moved > 4) { st.az.t = st.az0 + dx * 0.25; clock.wake(); return; }
          }
          if (e.pointerType === "touch") return;
          const id = pick(e);
          if (id !== hover) { setHover(id); onHover?.(id); }
        }}
        onPointerUp={(e) => {
          st.drag = false;
          if (st.moved > 4) return;
          const id = pick(e);
          if (id) {
            const x = solids.find((s) => s.b.id + s.i === id)!;
            setState({ inspector: { kind: "building", id: x.b.name, from: null } });
          }
        }}
        onPointerLeave={() => { setHover(null); onHover?.(null); }}>
        <g className="cmap-ground">
          {[...campus.fields.map(() => "field"), ...campus.lawns.map(() => "lawn"), ...campus.water.map(() => "water"), ...campus.roads.map(() => "road")].map((k, i) => (
            <path key={i} ref={(el) => { if (el) groundEls.current[i] = el; }} className={"cg cg--" + k} />
          ))}
          {flats.map((x, i) => <path key={x.b.id + x.i} ref={(el) => { if (el) flatEls.current[i] = el; }} className={"cg cg--" + x.b.form} />)}
        </g>
        <g className="cmap-trees">
          {campus.trees.map((t, i) => <ellipse key={i} ref={(el) => { if (el) treeEls.current[i] = el; }} className={"ct" + (t.t === "terminalia" ? " ct--lanren" : "")} />)}
        </g>
        <g className="cmap-solids">
          {solids.map((x, k) => (
            <g key={x.b.id + x.i} ref={(el) => { if (el) els.current[k] = { g: el, sil: el.children[0] as SVGPathElement, win: el.children[1] as SVGPathElement, cr: el.children[2] as SVGPathElement }; }}
              className={"cb" + (hov === x.b.id + x.i ? " is-hot" : hov ? " is-dim" : "") + (x.b.poi ? " is-poi" : "")}>
              <path className="cb-sil" /><path className="cb-win" /><path className="cb-cr" />
            </g>
          ))}
        </g>
        <g ref={label} className="cmap-label" style={{ opacity: 0 }}>
          <path ref={labelL} className="cl-line" />
          <text ref={labelT} className="cl-t" textAnchor="middle" />
          <text ref={labelS} className="cl-s" textAnchor="middle" />
        </g>
      </svg>
      <div className="cmap-hint">拖动以旋转 · 悬停查看 · 点击打开</div>
    </div>
  );
}

export function useBuildings() {
  const c = useCampus();
  return c ? c.buildings.map((b, i) => ({ key: b.id + i, ...b })).filter((b) => b.poi && b.form !== "corr") : [];
}
