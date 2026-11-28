/**
 * 校园 · 地图 (006) — the real campus as one homologous drawing.
 *
 * Same camera, same models, three drawings (Experiment 003): the campus is a line drawing at rest,
 * and the building under the pointer develops — only it — into its real material, the way a
 * draughtsman tints the one building he is talking about. Clicking glides the camera to it and
 * opens its page; the list beside the map lights its building the same way. 线稿 / 白模 / 实景
 * develops the whole campus with a wavefront from the point last touched.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import * as THREE from "three";
import { createHomologousStage, type HomologousStage } from "../three/homologous";
import { mountCampus, type Place } from "../three/campus";
import { now as clockNow } from "../app/time";
import { setState } from "../app/store";
import { Segmented } from "../ui/controls";
import { useCampus } from "./CampusMap";

type Mode = "ink" | "clay" | "real";
const LEVEL: Record<Mode, number> = { ink: 0, clay: 0.5, real: 1 };
const HOME = { az: 214, el: 36 };

export default function CampusMap3D({ height = 560, focus, onHover, phone = false }: { height?: number; focus?: string | null; onHover?: (id: string | null) => void; phone?: boolean }) {
  const campus = useCampus();
  const host = useRef<HTMLDivElement>(null);
  const chip = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HomologousStage | null>(null);
  const placesRef = useRef<Place[]>([]);
  const homeRef = useRef<any>(null);
  const hotRef = useRef<Place | null>(null);
  const lastUv = useRef<[number, number]>([0.5, 0.5]);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<Mode>("ink");
  const [hover, setHover] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);

  useLayoutEffect(() => {
    if (!campus || !host.current) return;
    let disposed = false;
    const stage = createHomologousStage({
      host: host.current, reveal: 0, ortho: true, creaseLo: 0.3, creaseHi: 0.62, depthScale: 0.92, realInk: 0.05, gridShow: false, realPaper: true,
      view: { ...HOME, dist: 420, span: 300, tx: 0, ty: 0, tz: 0 },
      orbit: { az: true, el: true, zoom: true, elMin: 14, elMax: 78 },
      maxDpr: phone ? 1.5 : 1.75,
      onFrame: () => { placeChip(); return false; },
    });
    stageRef.current = stage;
    stage.U.uInkR.value = 0;
    mountCampus(stage, campus, { month: clockNow().getMonth() }).then((c) => {
      if (disposed) return;
      placesRef.current = c.places;
      // frame the buildings: centre of their box, span from the projected corners at the home turn
      const b = c.plate, ctr = b.getCenter(new THREE.Vector3());
      const home = { ...HOME, tx: ctr.x, ty: 0, tz: ctr.z, span: 300, dist: 420 };
      stage.setView(home, true);
      const corners = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? c.bounds.max.y : 0, i & 4 ? b.max.z : b.min.z));
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const p of corners) { const q = stage.project(p); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
      const { width, height: h } = stage.size;
      const k = Math.max((x1 - x0) / (width * 0.96), (y1 - y0) / (h * 0.9));
      home.span = 300 * k;
      stage.setView(home, true);
      homeRef.current = home;
      setReady(true);
      const base = stage.project(ctr);
      const uv: [number, number] = [base.x / width, 1 - base.y / h];
      lastUv.current = uv;
      stage.inkIn(uv, 1.5);
    }).catch(() => {});
    return () => { disposed = true; stage.dispose(); stageRef.current = null; placesRef.current = []; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campus, phone]);

  // the chip rides the roof of the lit building
  function placeChip() {
    const st = stageRef.current, el = chip.current, p = hotRef.current;
    if (!st || !el) return;
    if (!p) { el.classList.remove("is-on"); return; }
    const q = st.project(p.top);
    el.style.transform = `translate(${q.x.toFixed(1)}px, ${q.y.toFixed(1)}px)`;
    el.classList.add("is-on");
  }

  const hot = focus ?? hover;
  useEffect(() => {
    const st = stageRef.current;
    if (!st || !ready) return;
    const p = hot ? placesRef.current.find((x) => x.key === hot) ?? null : null;
    hotRef.current = p;
    st.setHighlightObjects(p ? [p.node] : null, 1);
    if (chip.current && p) {
      chip.current.querySelector("em")!.textContent = p.name;
      chip.current.querySelector("span")!.textContent = p.category;
    }
    placeChip();
    st.wake();
  }, [hot, ready]);

  const pickAt = (e: React.PointerEvent) => {
    const st = stageRef.current;
    if (!st) return null;
    const id = st.pick(e.clientX, e.clientY, placesRef.current.map((p) => ({ box: p.box, id: p.key })));
    return id;
  };
  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType === "touch" || e.buttons) return;
    const id = pickAt(e);
    if (id !== hover) { setHover(id); onHover?.(id); }
  };
  const onUp = (e: React.PointerEvent) => {
    const st = stageRef.current;
    if (!st || st.dragged) return;
    const id = pickAt(e);
    const r = host.current!.getBoundingClientRect();
    lastUv.current = [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height];
    const p = id ? placesRef.current.find((x) => x.key === id) : null;
    if (!p) return;
    // glide toward it, keep the turn, and open its page
    const c = p.box.getCenter(new THREE.Vector3()), sz = p.box.getSize(new THREE.Vector3());
    const home = homeRef.current;
    st.setView({ tx: c.x, ty: 0, tz: c.z, span: Math.max(36, Math.min(home.span * 0.6, Math.max(sz.x, sz.z) * 2.6)) });
    setZoomed(true);
    setHover(id); onHover?.(id);
    setState({ inspector: { kind: "building", id: p.name, from: null } });
  };
  const goHome = () => { const st = stageRef.current; if (st && homeRef.current) { st.setView(homeRef.current); setZoomed(false); } };
  const pickMode = (m: Mode) => {
    setMode(m);
    stageRef.current?.develop(LEVEL[m], lastUv.current, 1.3);
  };

  if (!campus) return <div className="cmap cmap--wait" style={{ height }}>正在展开校园…</div>;
  return (
    <div className={"cmap3" + (ready ? " is-ready" : "")} style={{ height }}>
      <div ref={host} className="cmap3-canvas" role="img" aria-label="海南中学府城校区三维地图：真实建筑模型，线稿、白模与实景同源"
        onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={() => { setHover(null); onHover?.(null); }} />
      <div ref={chip} className="cmap3-chip" aria-hidden="true"><i /><b><em /><span /></b></div>
      {!ready && <div className="cmap3-wait">正在载入 26 栋真实建筑…</div>}
      <div className="cmap3-modes">
        <Segmented<Mode> size="sm" value={mode} onChange={pickMode} label="表达" options={[{ id: "ink", label: "线稿" }, { id: "clay", label: "白模" }, { id: "real", label: "实景" }]} />
      </div>
      <button type="button" className={"cmap3-home" + (zoomed ? " is-on" : "")} onClick={goHome} tabIndex={zoomed ? 0 : -1}>全园</button>
      <div className="cmap3-hint">{phone ? "拖动环绕 · 点按建筑打开" : "拖动环绕 · 悬停显影 · 点击打开 · ⌘/Ctrl + 滚轮缩放"}</div>
    </div>
  );
}
