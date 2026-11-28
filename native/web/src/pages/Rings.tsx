/**
 * 年轮 · the HAIZ ring, ported from lanren/rings: one ring per year since 1923 (empty until the
 * archive begins in 1940), each ring's width from that year's rain, each day a cell around it.
 * Painted from the real ERA5 archive. A drawing of weather data — not this tree's real growth.
 */
import { useEffect, useRef, useState } from "react";
import { useClimate, wmo } from "../culture/useClimate";
import { layout, pick, paint, LENSES, FRAME } from "../culture/rings/disc";
import { parts } from "../culture/rings/climate";
import { PageHead } from "../ui/PageHead";
import { Segmented } from "../ui/controls";
import "./pages.css";

export default function Rings({ phone }: { phone: boolean }) {
  const c = useClimate();
  const cv = useRef<HTMLCanvasElement>(null);
  const [lens, setLens] = useState("wood");
  const lay = useRef<any>(null);
  const [hit, setHit] = useState<any>(null);
  const size = phone ? Math.min(window.innerWidth - 32, 420) : 560;
  useEffect(() => {
    if (!c || !cv.current) return;
    lay.current = lay.current ?? layout(c);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const px = Math.round(size * dpr);
    cv.current.width = px; cv.current.height = px;
    const ctx = cv.current.getContext("2d")!;
    // paint off the main gesture: a frame later so the lens switch feels instant
    const id = requestAnimationFrame(() => paint(ctx, px, c, lay.current, lens));
    return () => cancelAnimationFrame(id);
  }, [c, lens, size]);
  const onMove = (e: React.PointerEvent) => {
    if (!lay.current || !c) return;
    const r = cv.current!.getBoundingClientRect();
    const R = r.width / 2 / FRAME;
    const x = (e.clientX - r.left - r.width / 2) / R, y = (e.clientY - r.top - r.height / 2) / R;
    const p = pick(lay.current, x, y);
    if (!p || p.pith || p.future) { setHit(p?.future ? { y: p.y, future: true } : null); return; }
    if (p.blank) { setHit({ y: p.y, blank: true }); return; }
    const row = c.row(p.index), d = parts(p.index);
    setHit({ y: p.y, date: `${d.y} 年 ${d.m} 月 ${d.d} 日`, row, x: e.clientX - r.left, yy: e.clientY - r.top });
  };
  const note = LENSES.find((l: any) => l.id === lens)?.note;
  return (
    <div className="rings">
      <PageHead kicker="年轮 · Since 1923" title="年轮" sub="从 1923 年建校到今天，每年一圈；1940 年以前没有再分析数据，留白。环宽随当年雨量变化，每一格是一天。" />
      <div className="rings-body" data-rv>
        <div className="rings-disc" style={{ width: size, height: size }}>
          <canvas ref={cv} style={{ width: size, height: size }} onPointerMove={onMove} onPointerLeave={() => setHit(null)} aria-label="年轮：以年为圈、以日为格的天气横截面" role="img" />
          {!c && <div className="rings-wait">正在读取 ERA5 档案…</div>}
        </div>
        <aside className="rings-side">
          <Segmented value={lens} onChange={setLens} label="镜头" options={LENSES.map((l: any) => ({ id: l.id, label: l.label }))} />
          <p className="rings-note">{note}</p>
          <div className="rings-read" aria-live="polite">
            {hit?.date ? (
              <>
                <span className="t-kicker">{hit.y}</span>
                <b className="t-sub">{hit.date}</b>
                <dl>
                  <dt>气温</dt><dd className="t-num">{hit.row.tmin ?? "—"} – {hit.row.tmax ?? "—"} °C</dd>
                  <dt>降水</dt><dd className="t-num">{hit.row.rain ?? "—"} mm</dd>
                  <dt>阵风</dt><dd className="t-num">{hit.row.gust ?? "—"} km/h</dd>
                  <dt>天气</dt><dd>{wmo(hit.row.code)}</dd>
                </dl>
              </>
            ) : hit?.blank ? <><span className="t-kicker">{hit.y}</span><b className="t-sub">这一年没有再分析数据</b><p className="t-meta">ERA5 从 1940 年开始。</p></>
              : hit?.future ? <><span className="t-kicker">{hit.y}</span><b className="t-sub">这些日子还没有到来</b></>
              : <p className="t-meta">把指针放在年轮上，读出那一天。</p>}
          </div>
          <p className="rings-src">数据：ERA5 再分析（Copernicus C3S / ECMWF），经 Open-Meteo（CC BY 4.0）。网格约 25 km，不是校内气象站观测；台风等极端值通常被低估。{c ? `档案至 ${c.meta.last}。` : ""}</p>
        </aside>
      </div>
    </div>
  );
}
