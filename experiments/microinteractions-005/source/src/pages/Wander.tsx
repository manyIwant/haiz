/**
 * 入画 · the painted-lab images from the HAIZ repository, behind an optical loupe: the render is
 * the ground; the loupe — a disc of glass with a lit rim and a little refraction at its edge —
 * shows the painting of the same view underneath. Nothing is blended to pretend: each image is
 * itself, and the glass only chooses which one you see where.
 */
import { useRef, useState } from "react";
import { clock, spring, stepS, SP, clamp } from "../kernel/motion";
import { useConst, useTick } from "../kernel/react";
import { PageHead } from "../ui/PageHead";
import { Segmented } from "../ui/controls";
import "./pages.css";

const VIEWS = [
  { id: "lanshu", label: "榄仁", base: "img/painted/lanshu-noon.jpg", paint: "img/painted/lanshu-golden-lab-painting.jpg" },
  { id: "library", label: "图书馆", base: "img/painted/library-noon.jpg", paint: "img/painted/library-golden-lab-painting.jpg" },
];

export default function Wander({ phone }: { phone: boolean }) {
  const [v, setV] = useState("lanshu");
  const view = VIEWS.find((x) => x.id === v)!;
  const box = useRef<HTMLDivElement>(null);
  const loupe = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const rest = phone ? 78 : 124, pressed = phone ? 104 : 156;
  const s = useConst(() => ({ x: spring(0.62, SP.follow), y: spring(0.5, SP.follow), r: spring(rest, SP.ui), on: false }));
  useTick((dt) => {
    const a = stepS(s.x, dt), b = stepS(s.y, dt), c = stepS(s.r, dt);
    const el = box.current;
    if (el && loupe.current && inner.current) {
      const W = el.clientWidth, H = el.clientHeight;
      const x = s.x.x * W, y = s.y.x * H, r = s.r.x;
      const sx = clamp(s.x.v * 0.0016, -0.08, 0.08) * clock.intensity;
      loupe.current.style.transform = `translate3d(${(x - r).toFixed(1)}px, ${(y - r).toFixed(1)}px, 0) skewX(${(-sx * 40).toFixed(2)}deg)`;
      loupe.current.style.width = loupe.current.style.height = `${(2 * r).toFixed(1)}px`;
      // the painting inside, magnified about the point under the pointer: that point lands on the
      // loupe's centre (translate after scale, both about the same origin), so nothing drifts
      inner.current.style.width = `${W}px`; inner.current.style.height = `${H}px`;
      inner.current.style.transformOrigin = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
      inner.current.style.transform = `translate3d(${(-x + r).toFixed(1)}px, ${(-y + r).toFixed(1)}px, 0) scale(${(1.08 + (s.r.x - rest) / 600).toFixed(4)})`;
    }
    return a || b || c;
  });
  const move = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    s.x.t = clamp((e.clientX - r.left) / r.width, 0, 1);
    s.y.t = clamp((e.clientY - r.top) / r.height, 0, 1);
    clock.wake();
  };
  return (
    <div className="wander">
      <PageHead kicker="入画 · Painted lab" title="入画" sub="同一处校园，一张是渲染，一张是画。移动这片玻璃，看画笔怎样重写光线。"
        aside={<Segmented value={v} onChange={setV} options={VIEWS.map((x) => ({ id: x.id, label: x.label }))} label="选择画面" />} />
      <div ref={box} className="wander-stage" data-rv onPointerMove={move} onPointerDown={(e) => { move(e); s.r.t = pressed; clock.wake(); }} onPointerUp={() => { s.r.t = rest; clock.wake(); }}
        onPointerLeave={() => { s.r.t = rest; clock.wake(); }} style={{ touchAction: "none" }}>
        <img src={view.base} alt={`${view.label}：校园渲染图`} className="wander-base" />
        <div ref={loupe} className="loupe">
          <div ref={inner} className="loupe-in"><img src={view.paint} alt={`${view.label}：同一视角的绘画`} /></div>
          <span className="loupe-rim" />
        </div>
      </div>
      <p className="foot-note">图像：HAIZ 绘画实验（painted-lab）中同一机位的正午渲染与黄昏绘画；渲染图上原有的对比滑块标记已修除（它左右两半原是两种着色方案，中缝处仍有细微差异）。完整的入画体验在主站：<a className="link" href="https://haiz.space/ruhua-free.html" target="_blank" rel="noopener">haiz.space · 入画 ↗</a></p>
    </div>
  );
}
