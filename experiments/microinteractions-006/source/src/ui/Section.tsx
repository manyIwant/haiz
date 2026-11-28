import type { ReactNode } from "react";

export function Section({ title, kicker, action, children, className }: { title?: ReactNode; kicker?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={"sec" + (className ? " " + className : "")} data-rv>
      {(title || action) && (
        <header className="sec-h">
          <div>{kicker && <div className="t-kicker">{kicker}</div>}{title && <h2 className="t-title">{title}</h2>}</div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
