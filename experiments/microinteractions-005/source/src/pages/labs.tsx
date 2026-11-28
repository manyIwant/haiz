/**
 * 交互实验册 · three small living experiments, drawn as hairline figures (Hairline's grammar:
 * bright silhouette, dim inside, one lit mark). Real physics, simplified; values are rounded.
 */
import { useRef, useState } from "react";
import { clock, clamp } from "../kernel/motion";
import { useConst, useTick, useVisible } from "../kernel/react";
import { Slider } from "../ui/controls";

/* ---------- 单摆 · a pendulum whose period follows √L ---------- */
export function Pendulum({ w = 320, h = 210 }: { w?: number; h?: number }) {
  const [L, setL] = useState(0.8); // metres
  const bob = useRef<SVGCircleElement>(null);
  const rod = useRef<SVGLineElement>(null);
  const arc = useRef<SVGPathElement>(null);
  const trail = useRef<SVGPathElement>(null);
  const s = useConst(() => ({ th: 0.42, om: 0, pts: [] as number[][] }));
  const box = useRef<HTMLDivElement>(null);
  const vis = useVisible(box);
  const g = 9.8;
  const px = (L * 150) / 1.2 + 40; // pixels for the rod
  useTick((dt) => {
    // small-step integration of θ'' = −(g/L) sin θ, kept alive by a whisper of drive so it never sleeps forever
    const n = Math.max(1, Math.ceil(dt * 240)), hh = dt / n;
    for (let i = 0; i < n; i++) { s.om += -(g / L) * Math.sin(s.th) * hh; s.th += s.om * hh; }
    const cx = w / 2, cy = 18;
    const x = cx + Math.sin(s.th) * px, y = cy + Math.cos(s.th) * px;
    rod.current?.setAttribute("x2", x.toFixed(2));
    rod.current?.setAttribute("y2", y.toFixed(2));
    bob.current?.setAttribute("cx", x.toFixed(2));
    bob.current?.setAttribute("cy", y.toFixed(2));
    s.pts.push([x, y]);
    if (s.pts.length > 26) s.pts.shift();
    trail.current?.setAttribute("d", s.pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(""));
    const a0 = 0.42;
    arc.current?.setAttribute("d", `M${(cx - Math.sin(a0) * px).toFixed(1)} ${(cy + Math.cos(a0) * px).toFixed(1)}A${px.toFixed(1)} ${px.toFixed(1)} 0 0 0 ${(cx + Math.sin(a0) * px).toFixed(1)} ${(cy + Math.cos(a0) * px).toFixed(1)}`);
    return vis.current && clock.intensity > 0.04;
  });
  const T = 2 * Math.PI * Math.sqrt(L / g);
  return (
    <div className="lab" ref={box}>
      <svg className="lab-svg" viewBox={`0 0 ${w} ${h}`} width="100%" aria-label={`单摆，摆长 ${L.toFixed(2)} 米`}>
        <path d={`M${w / 2 - 40} 18H${w / 2 + 40}`} className="hl-pri" />
        {Array.from({ length: 9 }, (_, i) => <path key={i} d={`M${w / 2 - 36 + i * 9} 18l-5 -6`} className="hl-sub" />)}
        <path ref={arc} className="hl-sub" strokeDasharray="2 4" />
        <path ref={trail} className="hl-fine" />
        <line ref={rod} x1={w / 2} y1={18} x2={w / 2} y2={18 + px} className="hl-sec" />
        <circle ref={bob} r={9} className="hl-solid" />
        <circle cx={w / 2} cy={18} r={2.2} className="hl-lit" />
      </svg>
      <div className="lab-ctl">
        <span className="lab-l">摆长</span>
        <Slider value={L} min={0.2} max={1.2} step={0.01} onChange={(v) => { setL(v); }} format={(v) => `${v.toFixed(2)} m`} label="摆长" />
        <span className="lab-v t-num">T ≈ {T.toFixed(2)} s</span>
      </div>
    </div>
  );
}

/* ---------- 磁铁与线圈 · drag the magnet; the meter needle follows dΦ/dt ---------- */
export function MagnetCoil({ w = 320, h = 170 }: { w?: number; h?: number }) {
  const mag = useRef<SVGGElement>(null);
  const needle = useRef<SVGLineElement>(null);
  const arrows = useRef<SVGGElement>(null);
  const s = useConst(() => ({ x: 60, tx: 60, v: 0, needle: 0, nv: 0, drag: false }));
  const coilX = w * 0.66;
  useTick((dt) => {
    const prev = s.x;
    s.x += (s.tx - s.x) * Math.min(1, dt * 18);
    s.v = dt > 0 ? (s.x - prev) / dt : 0;
    // flux ~ 1/(d² + c): its change drives the needle (Lenz: the sign flips between approach and retreat)
    const d = (coilX - (s.x + 46)) / 40;
    const dPhi = (-2 * d) / Math.pow(d * d + 1, 2) * (s.v / 40);
    const target = clamp(-dPhi * 1.4, -1, 1);
    const a = 160 * (target - s.needle) - 14 * s.nv;
    s.nv += a * dt; s.needle += s.nv * dt;
    tfm(mag.current, `translate(${s.x.toFixed(2)} 0)`);
    needle.current?.setAttribute("transform", `rotate(${(s.needle * 55).toFixed(2)} ${coilX} 150)`);
    if (arrows.current) arrows.current.style.opacity = Math.min(1, Math.abs(target) * 3).toFixed(2), arrows.current.setAttribute("transform", target < 0 ? `scale(-1 1) translate(${-2 * coilX} 0)` : "");
    return s.drag || Math.abs(s.tx - s.x) > 0.1 || Math.abs(s.nv) > 0.002 || Math.abs(s.needle) > 0.002;
  });
  return (
    <div className="lab">
      <svg className="lab-svg" viewBox={`0 0 ${w} ${h}`} width="100%" style={{ touchAction: "none" }} aria-label="磁铁与线圈：拖动磁铁"
        onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); s.drag = true; clock.wake(); }}
        onPointerMove={(e) => { if (!s.drag) return; const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect(); s.tx = clamp(((e.clientX - r.left) / r.width) * w - 46, 8, coilX - 120); clock.wake(); }}
        onPointerUp={() => { s.drag = false; }}>
        <g ref={mag} style={{ cursor: "grab" }}>
          <rect x={0} y={52} width={46} height={26} rx={4} className="hl-solid" />
          <rect x={23} y={52} width={23} height={26} rx={0} className="hl-litfill" />
          <text x={9} y={70} className="hl-txt">S</text><text x={30} y={70} className="hl-txt hl-txt--on">N</text>
        </g>
        {Array.from({ length: 7 }, (_, i) => <ellipse key={i} cx={coilX - 30 + i * 10} cy={65} rx={5} ry={24} className="hl-sec" />)}
        <path d={`M${coilX - 30} 89 V150 H${coilX - 26} M${coilX + 30} 89 V150 H${coilX + 26}`} className="hl-fine" />
        <path d={`M${coilX - 26} 150 A26 26 0 0 1 ${coilX + 26} 150`} className="hl-pri" />
        <line ref={needle} x1={coilX} y1={150} x2={coilX} y2={128} className="hl-litline" />
        <g ref={arrows} style={{ opacity: 0 }}><path d={`M${coilX - 18} 34 h36 m-6 -4 l6 4 l-6 4`} className="hl-lit-stroke" /></g>
      </svg>
      <div className="lab-ctl"><span className="lab-l">拖动磁铁靠近或离开线圈：指针方向随之翻转（“来拒去留”）。</span></div>
    </div>
  );
}
const tfm = (el: Element | null, t: string) => el?.setAttribute("transform", t);

/* ---------- 凸透镜成像 · object distance → image (thin lens, f = 60px) ---------- */
export function Lens({ w = 320, h = 170 }: { w?: number; h?: number }) {
  const [u, setU] = useState(150);
  const f = 60, cx = w / 2, axis = h / 2 + 10, H = 34;
  const v = (u * f) / (u - f);
  const real = u > f;
  const m = -v / u;
  const ix = cx + v, ih = H * m;
  const ox = cx - u;
  const clampX = (x: number) => clamp(x, -400, w + 400);
  return (
    <div className="lab">
      <svg className="lab-svg" viewBox={`0 0 ${w} ${h}`} width="100%" aria-label="凸透镜成像">
        <path d={`M0 ${axis}H${w}`} className="hl-sub" />
        <path d={`M${cx} ${axis - 58} Q${cx + 10} ${axis} ${cx} ${axis + 58} Q${cx - 10} ${axis} ${cx} ${axis - 58}`} className="hl-pri" />
        {[-f, f, -2 * f, 2 * f].map((d) => <circle key={d} cx={cx + d} cy={axis} r={1.8} className="hl-dotfill" />)}
        <path d={`M${ox} ${axis}V${axis - H}`} className="hl-pri" markerEnd="" />
        <path d={`M${ox - 4} ${axis - H + 6} L${ox} ${axis - H} L${ox + 4} ${axis - H + 6}`} className="hl-pri" />
        {/* two principal rays */}
        <path d={`M${ox} ${axis - H} H${cx} L${clampX(real ? ix : cx + 3 * f)} ${real ? axis - ih : axis + (H / f) * 3 * f - H}`} className="hl-litline" />
        <path d={`M${ox} ${axis - H} L${clampX(real ? ix : cx + 200)} ${real ? axis - ih : axis - H + ((H) / u) * 200}`} className="hl-fine" />
        {!real && <path d={`M${cx} ${axis - H} L${clampX(ix)} ${axis - ih} M${ox} ${axis - H} L${clampX(ix)} ${axis - ih}`} className="hl-sub" strokeDasharray="3 4" />}
        {Math.abs(ix) < 2000 && <path d={`M${clampX(ix)} ${axis}V${axis - ih}`} className={real ? "hl-litline" : "hl-sec"} strokeDasharray={real ? "" : "3 3"} />}
      </svg>
      <div className="lab-ctl">
        <span className="lab-l">物距</span>
        <Slider value={u} min={30} max={240} step={1} onChange={setU} format={(x) => `${(x / f).toFixed(2)} f`} label="物距" />
        <span className="lab-v">{real ? (u > 2 * f ? "倒立缩小实像" : u === 2 * f ? "倒立等大实像" : "倒立放大实像") : u === f ? "不成像" : "正立放大虚像"}</span>
      </div>
    </div>
  );
}
