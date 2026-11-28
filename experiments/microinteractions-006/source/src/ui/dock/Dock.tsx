import { useLayoutEffect, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { DockEngine, type DockConfig } from "./engine";
import "./dock.css";

export type DockProps = {
  config: DockConfig;
  onEnter(id: string): void;
  onSearch?(open: boolean): void;
  onQuery?(q: string): void;
  /** content of the stage that a bay grows on dwell; `close` folds it */
  renderStage?(id: string, close: () => void): ReactNode;
  renderResults?(): ReactNode;
  inline?: boolean;
  className?: string;
  engineRef?: (e: DockEngine | null) => void;
};

export function Dock(p: DockProps) {
  const host = useRef<HTMLDivElement>(null);
  const eng = useRef<DockEngine | null>(null);
  const [ready, setReady] = useState(false);
  const [staged, setStaged] = useState<string | null>(null);
  const [shown, setShown] = useState<string | null>(null);
  const cbs = useRef(p);
  cbs.current = p;

  useLayoutEffect(() => {
    const e = new DockEngine(host.current!, p.config, {
      onEnter: (id) => cbs.current.onEnter(id),
      onStage: (id) => setStaged(id),
      onSearch: (o) => cbs.current.onSearch?.(o),
      onQuery: (q) => cbs.current.onQuery?.(q),
    });
    eng.current = e;
    p.engineRef?.(e);
    setReady(true);
    return () => { p.engineRef?.(null); e.destroy(); eng.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useLayoutEffect(() => { eng.current?.update(p.config); });
  // the content stays while the contour folds back down
  useEffect(() => {
    if (staged) { setShown(staged); return; }
    const t = setTimeout(() => setShown(null), 460);
    return () => clearTimeout(t);
  }, [staged]);

  const e = eng.current;
  return (
    <div ref={host} className={`dock-host${p.inline ? " dock-host--inline" : ""}${p.className ? " " + p.className : ""}`}>
      {ready && e && shown && p.renderStage && createPortal(<div className="stg-wrap" key={shown}>{p.renderStage(shown, () => e.closeStage())}</div>, e.stageInner)}
      {ready && e && p.config.searchOpen && p.renderResults && createPortal(p.renderResults(), e.satStageInner)}
    </div>
  );
}
