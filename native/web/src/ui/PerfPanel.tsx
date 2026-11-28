/**
 * 性能面板 · the developer performance panel (HAIZ Native 001). Off by default (我 › 开发者).
 *
 * Measures the real device: frame times from rAF, long tasks from PerformanceObserver, the app
 * clock's own telemetry, renderer pass counts, JS heap and DOM size, and on Android the native
 * side (refresh rate, memory, PSS, thermal status). It only runs while it is open; 导出 saves a
 * JSON report through the system file picker so numbers from the phone can be compared with the
 * emulated bench.
 */
import { useEffect, useRef, useState } from "react";
import { setState } from "../app/store";
import { clock } from "../kernel/motion";
import { homoStats } from "../three/homologous";
import { HaizNative, isNative, saveText, type DeviceInfo } from "../platform/native";
import "./perf.css";

type Win = { fps: number; p50: number; p95: number; worst: number; dropped: number; long: number; longMs: number };

export function PerfPanel() {
  const graph = useRef<HTMLCanvasElement>(null);
  const [w, setW] = useState<Win>({ fps: 0, p50: 0, p95: 0, worst: 0, dropped: 0, long: 0, longMs: 0 });
  const [dev, setDev] = useState<DeviceInfo | null>(null);
  const [small, setSmall] = useState(false);
  const log = useRef<{ t: number; win: Win; route: string; heap: number; nodes: number; homo: typeof homoStats; active: number }[]>([]);
  const started = useRef(Date.now());
  const all = useRef({ frames: 0, dropped: 0, long: 0, longMs: 0, worst: 0 });

  useEffect(() => {
    let raf = 0, last = performance.now();
    let frames: number[] = [];
    let longs = 0, longMs = 0;
    const budget = { v: 1000 / 60 };
    const g = graph.current?.getContext("2d");
    const hist: number[] = [];
    let po: PerformanceObserver | null = null;
    try {
      po = new PerformanceObserver((l) => { for (const e of l.getEntries()) { longs++; longMs += e.duration; all.current.long++; all.current.longMs += e.duration; } });
      po.observe({ type: "longtask", buffered: false } as any);
    } catch { /* not supported */ }
    const loop = (now: number) => {
      const dt = now - last; last = now;
      frames.push(dt); hist.push(dt); if (hist.length > 120) hist.shift();
      all.current.frames++; if (dt > budget.v * 1.5) all.current.dropped++;
      all.current.worst = Math.max(all.current.worst, dt);
      if (g) {
        const c = g.canvas, H = c.height, W = c.width;
        g.clearRect(0, 0, W, H);
        g.strokeStyle = "rgba(255,255,255,.25)"; g.beginPath(); const y16 = H - (budget.v / 50) * H; g.moveTo(0, y16); g.lineTo(W, y16); g.stroke();
        for (let i = 0; i < hist.length; i++) {
          const v = hist[i], h = Math.min(H, (v / 50) * H);
          g.fillStyle = v > budget.v * 1.5 ? "#ff7a6a" : v > budget.v * 1.1 ? "#ffd27a" : "#8be0b0";
          g.fillRect(i * (W / 120), H - h, W / 120 - 1, h);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const tick = window.setInterval(() => {
      if (!frames.length) return;
      const s = [...frames].sort((a, b) => a - b);
      const total = frames.reduce((a, b) => a + b, 0);
      const fps = (frames.length * 1000) / total;
      // the panel learns the display's refresh rate from the fastest steady frames
      budget.v = Math.min(1000 / 50, Math.max(1000 / 144, s[Math.floor(s.length * 0.1)] || budget.v));
      const win: Win = { fps, p50: s[Math.floor(s.length / 2)], p95: s[Math.floor(s.length * 0.95)], worst: s[s.length - 1], dropped: frames.filter((x) => x > budget.v * 1.5).length / frames.length, long: longs, longMs };
      setW(win);
      log.current.push({ t: Date.now(), win, route: location.hash, heap: (performance as any).memory?.usedJSHeapSize / 1048576 || 0, nodes: document.getElementsByTagName("*").length, homo: { ...homoStats }, active: (clock as any).telemetry?.active ?? 0 });
      if (log.current.length > 600) log.current.shift();
      frames = []; longs = 0; longMs = 0;
    }, 1000);
    let di = 0;
    if (isNative()) { const f = () => HaizNative.info().then(setDev).catch(() => {}); f(); di = window.setInterval(f, 3000); }
    return () => { cancelAnimationFrame(raf); clearInterval(tick); clearInterval(di); po?.disconnect(); };
  }, []);

  const exportReport = async () => {
    const report = {
      format: "haiz-perf-report", version: 1, app: "HAIZ Native", ua: navigator.userAgent,
      screen: { w: screen.width, h: screen.height, dpr: devicePixelRatio, vw: innerWidth, vh: innerHeight },
      device: dev, startedAt: new Date(started.current).toISOString(), endedAt: new Date().toISOString(),
      totals: { ...all.current, droppedPct: all.current.frames ? all.current.dropped / all.current.frames : 0 },
      homologous: { ...homoStats }, perSecond: log.current,
    };
    try { const where = await saveText(`haiz-perf-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`, JSON.stringify(report, null, 1)); console.info("[perf] saved", where); } catch (e) { console.warn(e); }
  };

  const heap = (performance as any).memory?.usedJSHeapSize;
  return (
    <div className={"perf" + (small ? " is-small" : "")} role="status" aria-label="性能面板">
      <button type="button" className="perf-fps" onClick={() => setSmall(!small)} title="收起 / 展开">
        <b className={w.dropped > 0.1 ? "bad" : w.dropped > 0.02 ? "warn" : "ok"}>{w.fps.toFixed(0)}</b><span>fps</span>
      </button>
      {!small && <>
        <canvas ref={graph} width={240} height={48} className="perf-g" />
        <dl>
          <dt>帧时 p50 / p95</dt><dd>{w.p50.toFixed(1)} / {w.p95.toFixed(1)} ms</dd>
          <dt>最差帧</dt><dd>{w.worst.toFixed(0)} ms</dd>
          <dt>掉帧</dt><dd>{(w.dropped * 100).toFixed(1)}%</dd>
          <dt>长任务</dt><dd>{w.long} · {w.longMs.toFixed(0)} ms</dd>
          <dt>渲染 scene / nd / 跳过</dt><dd>{homoStats.scene} / {homoStats.nd} / {homoStats.pbrSkipped}</dd>
          {heap ? <><dt>JS 堆</dt><dd>{(heap / 1048576).toFixed(1)} MB</dd></> : null}
          {dev && <><dt>刷新率</dt><dd>{dev.refreshRate.toFixed(0)} Hz</dd>
            <dt>应用内存 PSS</dt><dd>{dev.appPssMB} MB</dd>
            <dt>可用内存</dt><dd>{dev.memAvailMB} / {dev.memTotalMB} MB</dd>
            {dev.thermal !== undefined && <><dt>温控等级</dt><dd>{dev.thermal}</dd></>}</>}
          <dt>总计</dt><dd>{all.current.frames} 帧 · 掉 {all.current.dropped}</dd>
        </dl>
        <div className="perf-a">
          <button type="button" onClick={exportReport}>导出报告</button>
          <button type="button" onClick={() => setState({ perfPanel: false })}>关闭</button>
        </div>
      </>}
    </div>
  );
}
