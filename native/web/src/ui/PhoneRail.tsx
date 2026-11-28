/**
 * 侧轨 · the phone drawer (HAIZ Native 002). The desk rail of 005/006 — paper, the liquid datum on
 * its right edge, the optical drop that grows out of it with a glimpse of the destination — slid
 * in from the left edge of the phone. It replaces Native 001's curtain: the rail was the approved
 * design, so the phone gets the rail, adapted for a finger (press, scrub, lift; swipe left to
 * shut). The sheet's travel is a spring on the motion clock and follows the finger while dragged.
 */
import { useEffect, useLayoutEffect, useRef } from "react";
import { clock, spring, stepS, settle, SP } from "../kernel/motion";
import { pushBack } from "../platform/native";
import { Rail } from "./Rail";
import "./phonerail.css";

export function PhoneRail({ onClose }: { onClose(): void }) {
  const box = useRef<HTMLDivElement>(null);
  const s = useRef({ o: spring(0, SP.lift), drag: null as number | null, closing: false, off: null as null | (() => void), w: 0 }).current;

  const paint = () => {
    const el = box.current;
    if (!el) return;
    const o = s.drag !== null ? Math.max(0, Math.min(1, 1 + s.drag / Math.max(1, s.w))) : s.o.x;
    el.style.setProperty("--o", Math.max(0, Math.min(1.04, o)).toFixed(4));
  };
  const run = () => {
    if (s.off) return;
    s.off = clock.add((dt) => {
      const m = s.drag === null && stepS(s.o, dt);
      paint();
      if (!m && s.drag === null) {
        s.off?.(); s.off = null;
        if (s.closing && s.o.x <= 0.001) onClose();
        return false;
      }
      return true;
    });
  };
  const close = () => { if (s.closing) return; s.closing = true; s.o.t = 0; run(); };
  useLayoutEffect(() => {
    s.w = box.current?.querySelector<HTMLElement>(".prail-sheet")?.offsetWidth ?? 280;
    if (clock.intensity < 0.04) settle(s.o, 1); else s.o.t = 1;
    paint();
    run();
    return () => { s.off?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => pushBack(close), []); // eslint-disable-line react-hooks/exhaustive-deps

  const onDrag = (dx: number, done: boolean, vx: number) => {
    if (!done) { s.drag = dx; paint(); return; }
    const o = Math.max(0, Math.min(1, 1 + dx / Math.max(1, s.w)));
    s.drag = null;
    s.o.x = o; s.o.v = vx * 1000 / Math.max(1, s.w);
    if (o < 0.62 || vx < -0.45) close(); else { s.o.t = 1; run(); }
  };

  return (
    <div ref={box} className="prail" style={{ ["--o" as any]: 0 }}>
      <button type="button" className="prail-scrim" aria-label="收起" onClick={close} />
      <div className="prail-sheet">
        <Rail compact={false} drawer={{ onClose: close, onDrag }} />
      </div>
    </div>
  );
}
