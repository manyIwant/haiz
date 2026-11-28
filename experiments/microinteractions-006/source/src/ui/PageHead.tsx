import type { ReactNode } from "react";

export function PageHead({ kicker, title, sub, aside }: { kicker: ReactNode; title: ReactNode; sub?: ReactNode; aside?: ReactNode }) {
  return (
    <header className="phead" data-rv>
      <div className="phead-l">
        <div className="t-kicker">{kicker}</div>
        <h1 className="t-display">{title}</h1>
        {sub && <p className="phead-sub">{sub}</p>}
      </div>
      {aside && <div className="phead-r">{aside}</div>}
    </header>
  );
}
