/**
 * 榄仁 · a year of the 大叶榄仁 (Terminalia catappa) beside the north gate. Hainan's 榄仁 turn
 * red and drop their leaves in the dry, cool months and flush new green in spring. The month
 * boundaries below are approximate (marked 约), and vary year to year.
 */
import { useMemo, useState } from "react";
import { PageHead } from "../ui/PageHead";
import { Section } from "../ui/Section";
import { Slider, Demo } from "../ui/controls";
import "./pages.css";

const MONTHS = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
/** leaf colour (0 green … 1 red), canopy fullness (0 bare … 1 full), and the phase's name */
const PHASE = [
  { red: 0.85, full: 0.45, young: 0, name: "红叶渐落" },
  { red: 0.6, full: 0.12, young: 0, name: "落叶 · 枝条疏朗" },
  { red: 0.05, full: 0.4, young: 0.9, name: "新叶萌发" },
  { red: 0, full: 0.72, young: 0.5, name: "嫩绿成荫" },
  { red: 0, full: 0.95, young: 0.15, name: "浓荫" },
  { red: 0, full: 1, young: 0, name: "浓荫 · 花期" },
  { red: 0, full: 1, young: 0, name: "浓荫 · 结果" },
  { red: 0, full: 1, young: 0, name: "浓荫" },
  { red: 0.02, full: 0.98, young: 0, name: "浓荫" },
  { red: 0.1, full: 0.95, young: 0, name: "零星红叶" },
  { red: 0.35, full: 0.86, young: 0, name: "叶色转暖" },
  { red: 0.7, full: 0.7, young: 0, name: "红叶满枝" },
];
const mix = (a: number[], b: number[], t: number) => a.map((x, i) => x + (b[i] - x) * t);
const rgb = (c: number[]) => `rgb(${c.map((v) => Math.round(v)).join(",")})`;
const GREEN = [70, 116, 66], YOUNG = [146, 178, 88], AMBER = [196, 142, 58], RED = [182, 70, 40];
/** autumn runs green → amber → red, not through mud */
const turn = (base: number[], t: number) => (t < 0.5 ? mix(base, AMBER, t * 2) : mix(AMBER, RED, (t - 0.5) * 2));
/** a deterministic hash in [0, 1) so the tree is the same tree on every visit */
const h01 = (k: number) => { const x = Math.sin(k * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

/* The 榄仁's pagoda form: whorls of near-horizontal branches in tiers, leaves in rosettes at the
   twig ends. Tiers are drawn as pairs of branches; each carries three rosettes. */
const TIERS = [[158, 122], [126, 110], [98, 86], [74, 54]] as const;
const CX = 160, GROUND = 238;
type Leaf = { x: number; y: number; a: number; s: number; th: number; k: number };
function bez(y: number, w: number, side: number, t: number) {
  const p0 = [CX, y + 6], p1 = [CX + side * w * 0.3, y + 2], p2 = [CX + side * w * 0.7, y], p3 = [CX + side * w, y - 6];
  const u = 1 - t;
  return [0, 1].map((i) => u * u * u * p0[i] + 3 * u * u * t * p1[i] + 3 * u * t * t * p2[i] + t * t * t * p3[i]);
}
function buildLeaves(): { leaves: Leaf[]; rosettes: number[][] } {
  const leaves: Leaf[] = [], rosettes: number[][] = [];
  let k = 0;
  TIERS.forEach(([y, w], ti) => {
    for (const side of [-1, 1]) {
      for (const t of w > 80 ? [0.34, 0.56, 0.78, 1] : [0.5, 0.78, 1]) {
        const [x, yy] = bez(y, w, side, t);
        const ry = yy - 5 - (t === 1 ? 2 : 0);
        rosettes.push([x, yy, x, ry]);
        const n = 8;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * 360 + h01(k) * 30 + ti * 11;
          leaves.push({ x, y: ry, a, s: 1.15 + h01(k + 99) * 0.5 * (t === 1 ? 1.15 : 1), th: h01(k + 7), k });
          k++;
        }
      }
    }
  });
  return { leaves, rosettes };
}
const LEAF = "M0 0C2.5 -2.4 9 -4.2 12.5 -0.6C13.2 0 13.2 0.6 12.5 1C9 4.2 2.5 2.4 0 0Z";

export default function Tree({ phone }: { phone: boolean }) {
  const [m, setM] = useState(new Date().getMonth());
  const i0 = Math.floor(m) % 12, i1 = (i0 + 1) % 12, t = m - Math.floor(m);
  const lerp = (a: number, b: number) => a + (b - a) * t;
  const ph = { red: lerp(PHASE[i0].red, PHASE[i1].red), full: lerp(PHASE[i0].full, PHASE[i1].full), young: lerp(PHASE[i0].young, PHASE[i1].young) };
  const { leaves, rosettes } = useMemo(buildLeaves, []);
  const col = (k: number) => {
    const j = h01(k + 3);
    const base = mix(GREEN, YOUNG, Math.min(1, ph.young * (0.6 + j * 0.6)));
    return rgb(turn(base, Math.min(1, ph.red * (0.65 + j * 0.6))));
  };
  // leaves that have let go lie on the ground for a while; how many depends on how bare the tree is
  const fallen = Math.round(Math.max(0, 1 - ph.full) * 18 * (ph.young > 0.3 ? 0.3 : 1));
  return (
    <div className="tree">
      <PageHead kicker="榄仁 · Terminalia catappa" title="榄仁" sub="北门入口与一号教学楼前，各立一株大叶榄仁。拖动月份，看它的一年。" />
      <div className="tree-body" data-rv>
        <figure className="tree-photo">
          <img src="img/web/lanshu-1600.jpg" alt="海南中学校园里的大叶榄仁树，枝干横展" loading="lazy" />
          <figcaption>校园里的百年榄仁 · 图：海南中学官网</figcaption>
        </figure>
        <div className="tree-fig">
          <svg viewBox="0 0 320 250" className="tree-svg" aria-label={`${MONTHS[i0]} · ${PHASE[i0].name}`}>
            {/* trunk: a slight taper, the bark's two edges */}
            <path d={`M${CX - 8} ${GROUND} C${CX - 6} 214 ${CX - 6} 186 ${CX - 4.5} ${TIERS[0][0] + 6} S${CX - 2} ${TIERS[3][0] + 14} ${CX - 1.2} ${TIERS[3][0] + 4}`} className="hl-pri" />
            <path d={`M${CX + 8} ${GROUND} C${CX + 6.5} 216 ${CX + 6} 190 ${CX + 4.5} ${TIERS[0][0] + 6} S${CX + 2} ${TIERS[3][0] + 14} ${CX + 1.2} ${TIERS[3][0] + 4}`} className="hl-pri" />
            <path d={`M${CX - 8} ${GROUND} q-9 0.5 -16 0 M${CX + 8} ${GROUND} q10 0.5 17 0`} className="hl-sec" />
            {TIERS.map(([y, w], j) => (
              <g key={j}>
                {[-1, 1].map((side) => (
                  <path key={side} d={`M${CX} ${y + 6} C${CX + side * w * 0.3} ${y + 2} ${CX + side * w * 0.7} ${y} ${CX + side * w} ${y - 6}`} className="hl-sec" />
                ))}
              </g>
            ))}
            {rosettes.map(([x, y, x2, y2], j) => <path key={j} d={`M${x.toFixed(1)} ${y.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`} className="hl-fine" />)}
            <path d={`M28 ${GROUND} H292`} className="hl-sub" />
            {Array.from({ length: 18 }, (_, k) => {
              const x = CX + (h01(k + 500) - 0.5) * 230, on = k < fallen;
              return <path key={"g" + k} d={LEAF} className="tree-leaf tree-leaf--down" fill={rgb(mix(turn(GREEN, 0.8 + h01(k + 3) * 0.2), [150, 120, 90], h01(k + 40) * 0.45))}
                style={{ transform: `translate(${x.toFixed(1)}px, ${GROUND - 1.5}px) scale(${0.8 + h01(k) * 0.3}, 0.42) rotate(${(h01(k + 9) * 360).toFixed(0)}deg)`, opacity: on ? 0.75 : 0 }} />;
            })}
            {leaves.map((l) => {
              const show = l.th < ph.full;
              const tf = show
                ? `translate(${l.x.toFixed(1)}px, ${l.y.toFixed(1)}px) scale(${l.s.toFixed(2)}, ${(l.s * 0.46).toFixed(2)}) rotate(${l.a.toFixed(0)}deg)`
                : `translate(${(l.x + (h01(l.k + 5) - 0.5) * 30).toFixed(1)}px, ${(l.y + 26).toFixed(1)}px) scale(${(l.s * 0.6).toFixed(2)}, ${(l.s * 0.3).toFixed(2)}) rotate(${(l.a + 120).toFixed(0)}deg)`;
              return <path key={l.k} d={LEAF} fill={col(l.k)} className="tree-leaf"
                style={{ transform: tf, opacity: show ? 0.9 : 0, transitionDelay: `calc(${(l.k % 21) * 14}ms / var(--ts, 1))` }} />;
            })}
          </svg>
          <div className="tree-phase"><b>{MONTHS[i0]}</b><span>{PHASE[i0].name}</span><span className="demo-tag">约</span></div>
          <Slider value={m} min={0} max={11.99} step={0.01} onChange={setM} format={(v) => MONTHS[Math.floor(v) % 12]} label="月份" />
          <div className="tree-months" aria-hidden="true">{MONTHS.map((x, k) => <span key={k} className={k === i0 ? "is-on" : ""}>{k + 1}</span>)}</div>
        </div>
      </div>
      <Section kicker="Notes" title="关于这株树">
        <p className="prose">大叶榄仁是热带常见的行道与庭院树，枝条分层平展，旱季前后叶片转红并集中落叶，春季很快抽出新叶。上面的月份划分是对海口一带常见物候的概括，每年随气温和雨水提前或推后；它不是对这株树的逐年观测记录。<Demo>物候为概括</Demo></p>
      </Section>
    </div>
  );
}
