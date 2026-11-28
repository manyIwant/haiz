import { useEffect, useLayoutEffect, useMemo, useRef, useState, lazy, Suspense, type ReactNode } from "react";
import { useViewport } from "../kernel/react";
import { useRoute, go, takeOrigin, TITLES, PRIMARY } from "./router";
import { useStore, setState, applyTheme, applyMotionVars, pauseFocus, stopFocus, fmtClock } from "./store";
import { search } from "./commands";
import { Rail } from "../ui/Rail";
import { Toolbar } from "../ui/Toolbar";
import { Dock } from "../ui/dock/Dock";
import type { DockItem } from "../ui/dock/engine";
import { Detail } from "../ui/Detail";
import { Icon } from "../ui/controls";
import { Stage, STAGE_SIZE } from "./stages";
import { renderDetail } from "../pages/details";
import { Today } from "../pages/Today";
import { Study } from "../pages/Study";
import { Focus } from "../pages/Focus";
import { Schedule } from "../pages/Schedule";
import { Growth } from "../pages/Growth";
import { Campus } from "../pages/Campus";
import { Me } from "../pages/Me";
import { Teacher } from "../pages/Teacher";
import { clock } from "../kernel/motion";
import { ThemeToggle } from "../ui/ThemeToggle";
import { Curtain } from "../ui/Curtain";

const Rings = lazy(() => import("../pages/Rings"));
const Tree = lazy(() => import("../pages/Tree"));
const Wander = lazy(() => import("../pages/Wander"));

const PARENT: Record<string, string> = { today: "today", schedule: "today", focus: "today", growth: "me", study: "study", campus: "campus", rings: "campus", tree: "campus", wander: "campus", me: "me", teacher: "me" };

export function App() {
  const vp = useViewport();
  const phone = vp === "phone";
  const route = useRoute();
  const role = useStore((s) => s.role);
  const railCompact = useStore((s) => s.railCompact);
  const compact = vp === "tablet" || railCompact;
  const focus = useStore((s) => s.focus);
  const focusLive = focus.state === "running" || focus.state === "paused";

  useLayoutEffect(() => { applyTheme(); applyMotionVars(); const off = clock.onTelemetry(() => {}); return off; }, []);
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const f = () => applyTheme();
    mq.addEventListener?.("change", f);
    return () => mq.removeEventListener?.("change", f);
  }, []);
  // the inspector belongs to a page: leaving the page closes it
  useEffect(() => { setState({ inspector: null, lensOpen: false }); window.scrollTo({ top: 0 }); }, [route.page]);

  const page = <PageHost route={route.raw} phone={phone} />;

  return phone ? (
    <div className="app app--phone" data-role={role === "teacher" ? "teacher" : undefined}>
      <PhoneTop page={route.page} />
      <main className="app-main" id="main">{page}</main>
      <PhoneDock active={PARENT[route.page] ?? "today"} focusLive={focusLive} focusText={fmtClock(focus.left)} paused={focus.state === "paused"} />
      <Detail phone render={renderDetail} />
      <Toasts phone />
    </div>
  ) : (
    <div className={`app app--desk${compact ? " is-compact" : ""}${focusLive && route.page === "focus" ? " is-focusing" : ""}`} data-role={role === "teacher" ? "teacher" : undefined}>
      <Rail compact={compact} />
      <div className="app-col">
        <Toolbar />
        <main className="app-main" id="main">{page}</main>
      </div>
      <DeskDock page={route.page} focusLive={focusLive} focusText={fmtClock(focus.left)} paused={focus.state === "paused"} />
      <Detail phone={false} render={renderDetail} />
      <Toasts />
    </div>
  );
}

/* ---------------- pages, revealed outward from where the gesture came from ---------------- */
function PageHost({ route, phone }: { route: string; phone: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [page, sub] = route.split("/");
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const o = takeOrigin();
    const r = el.getBoundingClientRect();
    const ox = o ? o.x : r.left + 40, oy = o ? o.y : r.top + 40;
    const items = [...el.querySelectorAll<HTMLElement>("[data-rv]")];
    for (const it of items) {
      const b = it.getBoundingClientRect();
      const d = Math.hypot(b.left + Math.min(b.width, 200) / 2 - ox, b.top + Math.min(b.height, 120) / 2 - oy);
      it.style.setProperty("--rv-d", `${Math.min(420, d * 0.32).toFixed(0)}ms`);
    }
    el.classList.remove("rv-in");
    void el.offsetWidth;
    el.classList.add("rv-in");
  }, [route]);
  const body = (() => {
    switch (page) {
      case "today": return <Today phone={phone} />;
      case "study": return <Study phone={phone} />;
      case "focus": return <Focus phone={phone} />;
      case "schedule": return <Schedule phone={phone} />;
      case "growth": return <Growth phone={phone} />;
      case "campus": return <Campus phone={phone} sub={sub ?? ""} />;
      case "rings": return <Rings phone={phone} />;
      case "tree": return <Tree phone={phone} />;
      case "wander": return <Wander phone={phone} />;
      case "me": return <Me phone={phone} />;
      case "teacher": return <Teacher phone={phone} />;
    }
    return <Today phone={phone} />;
  })();
  return (
    <div ref={ref} className={`page page--${page}${phone && !(PRIMARY as readonly string[]).includes(page) ? " page--push" : ""}`} key={route}>
      <Suspense fallback={<div className="page-wait">载入中…</div>}>{body}</Suspense>
    </div>
  );
}

/* ---------------- phone ---------------- */
function PhoneTop({ page }: { page: string }) {
  const [scrolled, setScrolled] = useState(false);
  const unread = useStore((s) => s.notices.some((n) => n.unread));
  useEffect(() => {
    const f = () => setScrolled(window.scrollY > 40);
    f();
    window.addEventListener("scroll", f, { passive: true });
    return () => window.removeEventListener("scroll", f);
  }, [page]);
  const pushed = !(PRIMARY as readonly string[]).includes(page);
  const [curtain, setCurtain] = useState(false);
  return (
    <>
    {curtain && <Curtain onClose={() => setCurtain(false)} />}
    <header className={"ptop" + (scrolled ? " is-scrolled" : "")}>
      {pushed
        ? <button type="button" className="ptop-back" onClick={() => (history.length > 1 ? history.back() : go(PARENT[page] ?? "today"))} aria-label="返回"><svg viewBox="0 0 16 16"><path d="M10 3 L5 8 L10 13" /></svg><span>{TITLES[PARENT[page]] ?? "返回"}</span></button>
        : <button type="button" className="ptop-seal" aria-label="全部去处" onClick={() => setCurtain(true)}>海</button>}
      <span className="ptop-t">{TITLES[page]}</span>
      <span className="ptop-r">
        <ThemeToggle size="sm" />
        <button type="button" className="ptop-btn" aria-label="通知" onClick={(e) => go("campus/notice", e.currentTarget)}><Icon kind="bell" size={21} />{unread && <i className="ptop-dot" />}</button>
      </span>
    </header>
    </>
  );
}

function PhoneDock({ active, focusLive, focusText, paused }: { active: string; focusLive: boolean; focusText: string; paused: boolean }) {
  const searchOpen = useStore((s) => s.searchOpen);
  const unread = useStore((s) => s.notices.some((n) => n.unread));
  const [q, setQ] = useState("");
  const items: DockItem[] = focusLive
    ? [
      { id: "f:pause", icon: "playpause", label: paused ? "继续" : "暂停" },
      { id: "f:time", label: "剩余时间", text: focusText, wide: 120 },
      { id: "f:stop", icon: "stop", label: "结束" },
    ]
    : [
      { id: "today", icon: "today", label: "今日", stage: STAGE_SIZE.today },
      { id: "study", icon: "study", label: "学习", stage: STAGE_SIZE.study },
      { id: "campus", icon: "campus", label: "校园", badge: unread, stage: STAGE_SIZE.campus },
      { id: "me", icon: "me", label: "我", stage: STAGE_SIZE.me },
    ];
  const res = useMemo(() => search(q), [q]);
  return (
    <Dock
      config={{ items, active: focusLive ? null : active, satellite: focusLive ? null : { id: "lens", icon: "lens", label: "搜索" }, size: "phone", searchOpen, searchStage: { w: 360, h: Math.min(420, 76 + res.length * 50) } }}
      onEnter={(id) => {
        if (id === "f:pause") pauseFocus();
        else if (id === "f:stop") stopFocus();
        else if (id === "f:time") go("focus");
        else go(id);
      }}
      onSearch={(o) => { setState({ searchOpen: o }); if (!o) setQ(""); }}
      onQuery={setQ}
      renderStage={(id, close) => <Stage id={id} close={close} phone />}
      renderResults={() => (
        <div className="sres">
          <div className="sres-h"><span>{q ? `“${q}”` : "试试"}</span><button type="button" className="sres-x" onClick={() => setState({ searchOpen: false })}>取消</button></div>
          <ul>
            {res.map((c, i) => (
              <li key={c.id} className="grow-r" style={{ ["--i" as any]: i }}>
                <button type="button" className="sres-row" onClick={() => { setState({ searchOpen: false }); c.run(); }}>
                  <Icon kind={c.icon} size={20} /><span className="sres-t">{c.title}</span>{c.meta && <span className="sres-m">{c.meta}</span>}
                </button>
              </li>
            ))}
            {!res.length && <li className="sres-empty">没有找到。试试“专注”“图书馆”“期中”。</li>}
          </ul>
        </div>
      )}
    />
  );
}

/* ---------------- desk: the contextual tool dock ---------------- */
const TOOLS: Record<string, DockItem[]> = {
  today: [
    { id: "plus", icon: "plus", label: "新建", stage: STAGE_SIZE.plus },
    { id: "focus", icon: "focus", label: "专注", stage: STAGE_SIZE.focus },
    { id: "schedule", icon: "schedule", label: "日程", stage: STAGE_SIZE.schedule },
    { id: "rings", icon: "rings", label: "年轮", stage: STAGE_SIZE.rings },
  ],
  study: [
    { id: "notes", icon: "notes", label: "笔记", stage: STAGE_SIZE.notes },
    { id: "lab", icon: "lab", label: "实验册", stage: STAGE_SIZE.lab },
    { id: "relay", icon: "relay", label: "接力", stage: STAGE_SIZE.relay },
    { id: "focus", icon: "focus", label: "专注", stage: STAGE_SIZE.focus },
  ],
  campus: [
    { id: "go:campus/notice", icon: "notice", label: "公告" },
    { id: "go:campus/club", icon: "club", label: "社团" },
    { id: "go:campus/map", icon: "map", label: "地图" },
    { id: "go:rings", icon: "culture", label: "文化" },
  ],
};
const GENERIC: DockItem[] = [
  { id: "plus", icon: "plus", label: "新建", stage: STAGE_SIZE.plus },
  { id: "focus", icon: "focus", label: "专注", stage: STAGE_SIZE.focus },
  { id: "schedule", icon: "schedule", label: "日程", stage: STAGE_SIZE.schedule },
];

function DeskDock({ page, focusLive, focusText, paused }: { page: string; focusLive: boolean; focusText: string; paused: boolean }) {
  const route = useRoute();
  const items: DockItem[] = focusLive
    ? [
      { id: "f:pause", icon: "playpause", label: paused ? "继续" : "暂停" },
      { id: "f:time", label: "剩余时间", text: focusText, wide: 118 },
      { id: "f:stop", icon: "stop", label: "结束" },
    ]
    : page === "rings" || page === "tree" || page === "wander" ? TOOLS.campus : TOOLS[page] ?? GENERIC;
  const active = page === "campus" ? "go:campus/" + (route.sub || "notice") : page === "rings" ? "go:rings" : null;
  if (page === "focus" && !focusLive) return null;
  return (
    <Dock
      className="dock-desk"
      config={{ items, active, satellite: null, size: "desk", searchOpen: false, searchStage: null }}
      onEnter={(id) => {
        if (id === "f:pause") pauseFocus();
        else if (id === "f:stop") stopFocus();
        else if (id === "f:time") go("focus");
        else if (id.startsWith("go:")) go(id.slice(3));
      }}
      renderStage={(id, close) => <Stage id={id} close={close} />}
    />
  );
}

/* ---------------- toasts: they rise from the dock (phone) or drop from the bar (desk) ---------------- */
function Toasts({ phone }: { phone?: boolean }) {
  const toasts = useStore((s) => s.toasts);
  return (
    <div className={"toasts" + (phone ? " toasts--phone" : "")} aria-live="polite">
      {toasts.map((t) => <div key={t.id} className={"toast glaze" + (t.tone === "lit" ? " toast--lit" : "")}><i className="toast-dot" />{t.text}</div>)}
    </div>
  );
}

