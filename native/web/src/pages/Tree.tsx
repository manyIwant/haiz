/**
 * 榄仁 · the century 大叶榄仁 (006).
 *
 * The tree is the real one HAIZ already had — Experiment 003's homologous study of tree.glb,
 * island.glb and rosettes.bin, with the main site's V4 leaves and its phenology model — not a
 * diagram. The month slider (005's liquid slider, kept) moves the day of the year, and every leaf
 * goes through its own colouring, letting go, budding and unfolding. Scrub fast and a gust goes
 * through the crown; in the falling months, leaves let go and drift down. Move the pointer through
 * the crown and it parts around it.
 *
 * The same object is three drawings: 线稿 (line), 白模 (paper clay), 实景 (real). Entering the page,
 * the line drawing is inked outward from the trunk and then develops into the real tree; switching
 * develops again from the trunk. 透镜 is a botanist's lens: over the real crown it shows structure.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { now as clockNow } from "../app/time";
import { isDark } from "../app/store";
import { PageHead } from "../ui/PageHead";
import { Section } from "../ui/Section";
import { Slider, Demo, Segmented } from "../ui/controls";
import { seasonAt, leafColour } from "../culture/season";
import { createHomologousStage, type HomologousStage } from "../three/homologous";
import { mountTerminalia } from "../three/terminalia";
import * as THREE from "three";
import "./pages.css";

const MONTHS = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
const doyOf = (m: number) => (m / 12) * 365;
/** the colour an average leaf has on that day (season.js's own ramp, sRGB for CSS) */
function leafCss(doy: number) {
  const s = seasonAt(doy);
  const turned = s.turn > 0 ? Math.min(1, Math.max(0, (s.turn - 0.25) * 0.95)) : 0;
  const young = s.flush < 0.95 ? (1 - s.flush) * 0.9 : 0;
  const c = leafColour(turned, 0.3, young, 0.5) as number[];
  const g = c.map((v) => Math.round(255 * Math.pow(Math.min(1, v * 2.1), 1 / 2.2)));
  const bare = s.fallen > 0.85 && s.flush < 0.12;
  return bare ? "rgb(150, 128, 104)" : `rgb(${g.join(",")})`;
}

type Mode = "ink" | "clay" | "real" | "lens";
const LEVEL: Record<Mode, number> = { ink: 0, clay: 0.5, real: 1, lens: 1 };

export default function Tree({ phone }: { phone: boolean }) {
  const [m, setM] = useState(() => { const d = clockNow(); return d.getMonth() + (d.getDate() - 1) / 31; });
  const [mode, setMode] = useState<Mode>("real");
  const [ready, setReady] = useState(false);
  const [noGL, setNoGL] = useState(false);
  const [count, setCount] = useState(0);
  const host = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HomologousStage | null>(null);
  const ctrl = useRef<any>(null);
  const lastM = useRef({ v: m, t: performance.now() });
  const season = useMemo(() => seasonAt(doyOf(m)), [m]);
  const ribbon = useMemo(() => Array.from({ length: 48 }, (_, i) => leafCss(doyOf((i + 0.5) / 4))), []);
  const tint = leafCss(doyOf(m));

  useLayoutEffect(() => {
    const el = host.current!;
    let disposed = false;
    let stage: HomologousStage;
    try { stage = createHomologousStage({
      host: el, reveal: 0, ortho: false, creaseLo: 0.36, creaseHi: 0.72, depthScale: 0.76, realInk: 0.03,
      view: phone ? { az: 34, el: 8, dist: 74, tx: -1.2, ty: 6.4, tz: -0.2, fov: 28 } : { az: 34, el: 7, dist: 58, tx: -1.8, ty: 6.9, tz: -0.2, fov: 26 },
      orbit: { az: true, el: true, zoom: true, elMin: 2, elMax: 60 },
      maxDpr: phone ? 1.5 : 1.75,
      onFrame: (dt) => ctrl.current?.update(dt) ?? false,
    }); } catch { setNoGL(true); return; }
    stageRef.current = stage;
    stage.U.uInkR.value = 0; // paper until the drawing arrives
    stage.hold(true);         // nothing to draw until the tree is in and its programs are compiled
    mountTerminalia(stage, { density: phone ? 0.3 : 0.42 }).then(async (c) => {
      if (disposed) return;
      c.setDay(doyOf(m), true);
      c.setNight(isDark());
      await stage.precompile();
      if (disposed) return;
      stage.hold(false);
      ctrl.current = c;
      c.setDay(doyOf(m), true);
      c.setNight(isDark());
      setCount(c.leafCount);
      setReady(true);
      // ink the drawing outward from the trunk, then let it develop into the real tree
      const base = stage.project(new THREE.Vector3(0, 0.6, 0));
      const uv = [base.x / stage.size.width, 1 - base.y / stage.size.height];
      stage.inkIn(uv, 1.25);
      window.setTimeout(() => { if (!disposed) stage.develop(LEVEL[mode], uv, 1.7); }, 950);
    }).catch(() => setReady(false));
    const mo = new MutationObserver(() => ctrl.current?.setNight(isDark()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => { disposed = true; mo.disconnect(); stage.dispose(); stageRef.current = null; ctrl.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone]);

  // the slider moves the year; its speed is the wind
  const onMonth = (v: number) => {
    const now = performance.now(), dt = Math.max(16, now - lastM.current.t);
    const speed = Math.abs(v - lastM.current.v) / (dt / 1000);   // months per second
    lastM.current = { v, t: now };
    setM(v);
    ctrl.current?.setDay(doyOf(v));
    if (speed > 0.4) ctrl.current?.gust(Math.min(1, speed / 14));
  };

  const pickMode = (next: Mode) => {
    setMode(next);
    const st = stageRef.current;
    if (!st) return;
    st.setLoupe(next === "lens" ? (phone ? 0.17 : 0.15) : 0, true);
    if (Math.abs(st.reveal - LEVEL[next]) > 0.01) {
      const b = st.project(new THREE.Vector3(0, 0.6, 0));
      st.develop(LEVEL[next], [b.x / st.size.width, 1 - b.y / st.size.height], 1.2);
    }
  };

  // the pointer through the crown: leaves part around it
  const lastP = useRef({ x: 0, y: 0, t: 0 });
  const onMove = (e: React.PointerEvent) => {
    const st = stageRef.current, c = ctrl.current;
    if (!st || !c || e.buttons) return;
    const now = performance.now(), L = lastP.current;
    const v = Math.hypot(e.clientX - L.x, e.clientY - L.y) / Math.max(8, now - L.t);
    if (now - L.t > 70 && v > 0.25) { c.touch(st.rayAt(e.clientX, e.clientY), Math.min(1.4, v * 0.9)); lastP.current = { x: e.clientX, y: e.clientY, t: now }; }
    else if (now - L.t > 70) lastP.current = { x: e.clientX, y: e.clientY, t: now };
  };

  // a handle for the acceptance script (npm run verify) — reads state, drives the slider
  useEffect(() => { (window as any).__tree = { month: onMonth, mode: pickMode, get stage() { return stageRef.current; }, get ctrl() { return ctrl.current; } }; return () => { delete (window as any).__tree; }; });

  const i0 = Math.floor(m) % 12;
  return (
    <div className="tree">
      <PageHead kicker="榄仁 · Terminalia catappa" title="榄仁" sub="北门入口与一号教学楼前，各立一株大叶榄仁。拖动月份，看它的一年。" />
      <div className="tree-body" data-rv>
        <figure className="tree-photo">
          <img src="img/web/lanshu-1600.jpg" alt="海南中学校园里的大叶榄仁树，枝干横展" loading="lazy" decoding="async" />
          <figcaption>校园里的百年榄仁 · 图：海南中学官网</figcaption>
        </figure>
        <div className="tree-fig">
          <div className={"tree-stage" + (ready ? " is-ready" : "")} onPointerMove={onMove}>
            <div ref={host} className="tree-canvas" aria-label={`三维榄仁树 · ${MONTHS[i0]} · ${season.label}。拖动可环绕。`} role="img" />
            {!ready && <div className="tree-wait">{noGL ? "这台设备没有可用的 WebGL，三维榄仁无法显示；左侧照片与下方月份仍可使用。" : "正在载入真实的榄仁树…"}</div>}
            <div className="tree-modes">
              <Segmented size="sm" value={mode} onChange={pickMode} label="表达"
                options={[{ id: "ink", label: "线稿" }, { id: "clay", label: "白模" }, { id: "real", label: "实景" }, { id: "lens", label: "透镜" }]} />
            </div>
          </div>
          <div className="tree-phase"><b>{MONTHS[i0]}</b><span>{season.label}</span><span className="demo-tag">推演</span></div>
          <Slider value={m} min={0} max={11.99} step={0.01} onChange={onMonth} format={(v) => MONTHS[Math.floor(v) % 12]} label="月份" tint={tint}
            onGrab={(on) => { if (!on) ctrl.current?.gust(0.05); }}
            backdrop={<div className="tree-ribbon">{ribbon.map((c, i) => <i key={i} style={{ background: c }} />)}</div>} />
          <div className="tree-months" aria-hidden="true">{MONTHS.map((x, k) => <span key={k} className={k === i0 ? "is-on" : ""}>{k + 1}</span>)}</div>
        </div>
      </div>
      <Section kicker="Notes" title="关于这株树">
        <p className="prose">
          右边是 HAIZ 已有的真实榄仁资产：<code>tree.glb</code> 的树干与板根（约 25 万顶点）、10,947 个叶簇展开的 {count ? count.toLocaleString() : "约三万"} 片叶，和它站立的太湖石岛；同一个模型、同一台相机，画成线稿、白模或实景，像素对齐（Experiment 003 的同源显影）。
          每片叶有自己的萌发时间；月份滑块驱动的是主站「年轮」使用的物候模型：旧叶先转红、各自落下，新梢在早春抽出古铜色的嫩叶再转绿。它是对海口一带大叶榄仁常见物候的推演，不是这株树的逐年观测，模型也是树种的概念模型而非实测。<Demo>物候为推演</Demo>
        </p>
      </Section>
    </div>
  );
}
