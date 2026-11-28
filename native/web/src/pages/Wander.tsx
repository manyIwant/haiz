/**
 * 入画 · the painted campus (006).
 *
 * Two layers of one art capability. The loupe (005, kept) is the quiet one: the render is the
 * ground, and a disc of glass shows the painting of the same view underneath. "走进画中" is the
 * loud one: the glass widens until the painting is the whole stage — at that size the painting
 * lies exactly over the render, so nothing jumps — and the live 画境实验室 (HAIZ's painted-lab:
 * the real campus model, painted in real time, five viewpoints, three times of day) comes up in
 * it. Closing narrows the glass back to the pointer.
 *
 * Both images of a view are decoded before either is shown (005's first entry showed the painting
 * alone, over an undecoded render), and a view change keeps the old pair until the new one is ready.
 */
import { useEffect, useRef, useState } from "react";
import { clock, spring, stepS, SP, clamp } from "../kernel/motion";
import { useConst, useTick } from "../kernel/react";
import { paintingLoadState } from "../platform/painting-load";
import { PageHead } from "../ui/PageHead";
import { Segmented } from "../ui/controls";
import "./pages.css";

const VIEWS = [
  { id: "lanshu", label: "榄仁", base: "img/painted/lanshu-noon.jpg", paint: "img/painted/lanshu-golden-lab-painting.jpg", time: "golden", note: "近景树冠与一号教学楼：交界色带、树荫里的冷色" },
  { id: "yihao", label: "教学楼", base: "img/painted/yihao-noon-base.jpg", paint: "img/painted/yihao-morning-lab-painting.jpg", time: "morning", note: "一号教学楼立面：窗洞深度、楼层节奏、墙脚的反光" },
  { id: "library", label: "图书馆", base: "img/painted/library-noon.jpg", paint: "img/painted/library-golden-lab-painting.jpg", time: "golden", note: "南面大台阶与弧形玻璃：大面墙的笔触尺度、树的剪影" },
  { id: "fengqi", label: "凤栖亭", base: "img/painted/fengqi-noon-base.jpg", paint: "img/painted/fengqi-morning-lab-painting.jpg", time: "morning", note: "亭与远处的教学楼：屋顶剪影、草地的近中远" },
  { id: "aerial", label: "鸟瞰", base: "img/painted/aerial-noon-base.jpg", paint: "img/painted/aerial-golden-lab-painting.jpg", time: "golden", note: "高处的四分之三视角：三个空间层次与空气透视" },
];
type View = (typeof VIEWS)[number];

const decoded = new Map<string, Promise<void>>();
function decode(src: string) {
  if (!decoded.has(src)) {
    const img = new Image();
    img.src = new URL(src, document.baseURI).href;
    decoded.set(src, img.decode().catch(() => new Promise<void>((res) => { img.onload = img.onerror = () => res(); if (img.complete) res(); })));
  }
  return decoded.get(src)!;
}
/** the live painted-lab: the public site by default; ?haiz=<base> points it elsewhere (local checks) */
function labUrl(v: View, phone: boolean) {
  const q = new URLSearchParams(location.search).get("haiz") ?? new URLSearchParams(location.hash.split("?")[1] ?? "").get("haiz");
  const base = q ?? new URL("./painting/", document.baseURI).href;
  return `${base.replace(/\/?$/, "/")}painted-lab.html?view=${v.id}&time=${v.time}&preset=painting&mode=lab${phone ? "&quality=medium" : ""}`;
}

export default function Wander({ phone }: { phone: boolean }) {
  const [v, setV] = useState("lanshu");
  const [shown, setShown] = useState<View | null>(null);
  const [inside, setInside] = useState(false);
  const [live, setLive] = useState(false);
  const [loadError, setLoadError] = useState("");
  const want = VIEWS.find((x) => x.id === v)!;
  const box = useRef<HTMLDivElement>(null);
  const loupe = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const rest = phone ? 78 : 124, pressed = phone ? 104 : 156;
  const s = useConst(() => ({ x: spring(0.62, SP.follow), y: spring(0.5, SP.follow), r: spring(rest, SP.ui), open: spring(0, { k: 60, c: 15 }), inside: false }));

  // decode both layers of a view before showing it; keep the old pair meanwhile
  useEffect(() => {
    let off = false;
    Promise.all([decode(want.base), decode(want.paint)]).then(() => { if (!off) { setShown(want); clock.wake(); } });
    return () => { off = true; };
  }, [want]);
  // warm the others once the first is up
  useEffect(() => { if (shown) for (const x of VIEWS) { decode(x.base); decode(x.paint); } }, [!!shown]);

  useTick((dt) => {
    const a = stepS(s.x, dt), b = stepS(s.y, dt), c = stepS(s.r, dt), d = stepS(s.open, dt);
    const el = box.current;
    if (el && loupe.current && inner.current) {
      const W = el.clientWidth, H = el.clientHeight;
      const x = s.x.x * W, y = s.y.x * H;
      // opening: the disc grows to cover the stage from where it is
      const cover = Math.hypot(Math.max(x, W - x), Math.max(y, H - y)) + 8;
      const o = clamp(s.open.x, 0, 1.2);
      const r = s.r.x + (cover - s.r.x) * o;
      const sx = clamp(s.x.v * 0.0016, -0.08, 0.08) * clock.intensity * (1 - Math.min(1, o));
      loupe.current.style.transform = `translate3d(${(x - r).toFixed(1)}px, ${(y - r).toFixed(1)}px, 0) skewX(${(-sx * 40).toFixed(2)}deg)`;
      loupe.current.style.width = loupe.current.style.height = `${(2 * r).toFixed(1)}px`;
      // the painting inside, magnified about the pointer; the magnification falls to 1 as the disc
      // opens, so at full size the painting sits exactly over the render
      const mag = (1.08 + (s.r.x - rest) / 600) * (1 - Math.min(1, o)) + Math.min(1, o);
      inner.current.style.width = `${W}px`; inner.current.style.height = `${H}px`;
      inner.current.style.transformOrigin = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
      inner.current.style.transform = `translate3d(${(-x + r).toFixed(1)}px, ${(-y + r).toFixed(1)}px, 0) scale(${mag.toFixed(4)})`;
      el.style.setProperty("--open", Math.min(1, o).toFixed(3));
    }
    return a || b || c || d;
  });
  const move = (e: React.PointerEvent) => {
    if (s.inside) return;
    const r = box.current!.getBoundingClientRect();
    s.x.t = clamp((e.clientX - r.left) / r.width, 0, 1);
    s.y.t = clamp((e.clientY - r.top) / r.height, 0, 1);
    clock.wake();
  };
  const enter = () => { s.inside = true; s.open.t = 1; s.r.t = rest; setInside(true); setLive(false); setLoadError(""); clock.wake(); };
  const leave = () => { s.inside = false; s.open.t = 0; setInside(false); setLive(false); clock.wake(); };
  useEffect(() => {
    if (!inside) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") leave(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inside]);

  const view = shown;
  return (
    <div className="wander">
      <PageHead kicker="入画 · Painted lab" title="入画" sub="同一处校园，一张是渲染，一张是画。移动这片玻璃，看画笔怎样重写光线；再走进去，画是活的。"
        aside={!phone && <Segmented value={v} onChange={(x) => { setV(x); if (inside) leave(); }} options={VIEWS.map((x) => ({ id: x.id, label: x.label }))} label="选择画面" />} />
      {phone && <div className="wander-seg" data-rv><Segmented size="sm" value={v} onChange={(x) => { setV(x); if (inside) leave(); }} options={VIEWS.map((x) => ({ id: x.id, label: x.label }))} label="选择画面" /></div>}
      <div ref={box} className={"wander-stage" + (view ? " is-ready" : "") + (inside ? " is-inside" : "") + (live ? " is-live" : "")} data-rv
        onPointerMove={move} onPointerDown={(e) => { if (s.inside) return; move(e); s.r.t = pressed; clock.wake(); }} onPointerUp={() => { if (!s.inside) { s.r.t = rest; clock.wake(); } }}
        onPointerLeave={() => { if (!s.inside) { s.r.t = rest; clock.wake(); } }} style={{ touchAction: inside ? "auto" : "none" }}>
        {view && <img key={view.base} src={view.base} alt={`${view.label}：校园渲染图`} className="wander-base" />}
        <div ref={loupe} className="loupe">
          <div ref={inner} className="loupe-in">{view && <img key={view.paint} src={view.paint} alt={`${view.label}：同一视角的绘画`} />}</div>
          <span className="loupe-rim" />
        </div>
        {!view && <div className="wander-wait">正在铺开画面…</div>}
        {inside && view && (
          <iframe className="wander-live" title={`画境实验室 · ${view.label}`} src={labUrl(view, phone)} onLoad={(e) => {
            const frame = e.currentTarget;
            const started = performance.now();
            const check = () => {
              if (!frame.isConnected) return;
              const state = paintingLoadState(frame.contentDocument?.body.dataset.stage, performance.now() - started);
              if (state === 'ready') setLive(true);
              else if (state === 'failed') { setLive(true); setLoadError('三维场景无法启动，请返回后重试'); }
              else if (state === 'timeout') setLoadError('载入时间较长，请返回后重试');
              else window.setTimeout(check, 200);
            };
            check();
          }} allow="fullscreen" />
        )}
        {view && !inside && (
          <button type="button" className="wander-enter" onClick={enter} onPointerDown={(e) => e.stopPropagation()}>
            <i aria-hidden="true" /><span>走进画中</span>
          </button>
        )}
        {inside && (
          <div className="wander-bar">
            <span className="wander-live-tag">{loadError || (live ? "实时绘制 · 可拖动环顾" : "正在把画布铺进三维校园…")}</span>
            <button type="button" className="wander-close" onClick={leave}>回到镜中</button>
          </div>
        )}
      </div>
      {view && <p className="wander-note"><b>{view.label}</b>{view.note}</p>}
      <p className="foot-note">图像与实时画面：HAIZ 绘画实验（painted-lab，同一机位的正午渲染与清晨或傍晚的绘画）；建筑来自项目的 Blender V3 近似模型，树木与天空为绘画式表达。完整的入画漫步在主站：<a className="link" href="https://haiz.space/ruhua-free.html" target="_blank" rel="noopener">haiz.space · 入画 ↗</a></p>
    </div>
  );
}
