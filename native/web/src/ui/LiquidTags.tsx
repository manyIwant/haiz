/**
 * 液态标签 · liquid tags (HAIZ Native 001, after the Whitespace "liquid tags" study, reimplemented).
 *
 * A row of step tags joined by a liquid: finished steps are one fused pill, the active step is
 * being filled by a drop that leads the liquid and necks off from it, and steps still to come wait
 * as separate beads. Used for the update (检查 · 下载 · 校验 · 安装) and identity switching.
 *
 * The metaball is a tiny SVG goo filter (blur + alpha threshold) over a strip a few hundred pixels
 * wide; the labels sit above it unfiltered. Positions are CSS custom properties with transitions,
 * so a progress event costs one style write and nothing runs when progress stops.
 */
import { useId, type CSSProperties } from "react";
import "./liquidtags.css";

export function LiquidTags({ steps, active, progress = 0, state = "ok", className }: { steps: string[]; active: number; progress?: number; state?: "ok" | "paused" | "error" | "done"; className?: string }) {
  const id = useId().replace(/:/g, "");
  const n = steps.length;
  const done = state === "done" ? n : Math.max(0, Math.min(n, active));
  const p = Math.max(0, Math.min(1, progress));
  const fill = state === "done" ? 1 : (done + (active < n ? p : 0)) / n;
  return (
    <div className={`ltags ltags--${state}${className ? " " + className : ""}`} style={{ ["--n" as any]: n, ["--fill" as any]: fill } as CSSProperties}
      role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fill * 100)} aria-valuetext={steps[Math.min(active, n - 1)]}>
      <svg className="ltags-defs" aria-hidden="true" width="0" height="0">
        <filter id={`goo${id}`} x="-10%" y="-60%" width="120%" height="220%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b" />
          <feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -9" />
        </filter>
      </svg>
      <div className="ltags-goo" style={{ filter: `url(#goo${id})` }} aria-hidden="true">
        {steps.map((_, i) => <i key={i} className={"ltags-bead" + (i < done ? " is-done" : i === active ? " is-active" : "")} style={{ ["--i" as any]: i } as CSSProperties} />)}
        <b className="ltags-liquid" />
        <b className="ltags-drop" />
      </div>
      <ol className="ltags-labels">
        {steps.map((s, i) => <li key={i} className={i < done ? "is-done" : i === active && state !== "done" ? "is-active" : ""}>{s}</li>)}
      </ol>
    </div>
  );
}
