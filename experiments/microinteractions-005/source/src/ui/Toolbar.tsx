/**
 * 顶栏 · the desk toolbar, and the command lens that grows out of its search field.
 *
 * Opening the lens is one contour: the field widens (its left neighbours — the breadcrumb —
 * yield and fade), and the results grow downward out of the field's own outline. The selection
 * plate glides between rows; results reorder on springs as you type.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { clock, spring, stepS, settle, SP, clamp } from "../kernel/motion";
import { useConst, useTick } from "../kernel/react";
import { useRoute, go, TITLES, CAMPUS_SUBS } from "../app/router";
import { useStore, setState, readAll, readNotice, isDark } from "../app/store";
import { search, type Cmd } from "../app/commands";
import { STUDENT, TEACHER } from "../data/demo";
import { Grow } from "./Grow";
import { Icon, Switch } from "./controls";

export function Toolbar() {
  const route = useRoute();
  const lensOpen = useStore((s) => s.lensOpen);
  const unread = useStore((s) => s.notices.filter((n) => n.unread).length);
  const notify = useStore((s) => s.notify);
  const role = useStore((s) => s.role);
  const field = useRef<HTMLButtonElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const crumbs = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);
  const [meOpen, setMeOpen] = useState(false);
  const bell = useRef<HTMLButtonElement>(null);
  const me = useRef<HTMLButtonElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [dark, setDark] = useState(isDark());
  const theme = useStore((s) => s.theme);
  useEffect(() => setDark(isDark()), [theme]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setState({ lensOpen: !lensOpen }); }
      if (e.key === "/" && !lensOpen && !(e.target as HTMLElement).closest("input, textarea")) { e.preventDefault(); setState({ lensOpen: true }); }
    };
    const sc = () => setScrolled(window.scrollY > 4);
    window.addEventListener("keydown", k);
    window.addEventListener("scroll", sc, { passive: true });
    return () => { window.removeEventListener("keydown", k); window.removeEventListener("scroll", sc); };
  }, [lensOpen]);

  // the field widens leftward into the room the breadcrumb gives up
  const [base, setBase] = useState<{ x0: number; x1: number } | null>(null);
  useLayoutEffect(() => {
    if (!lensOpen || !field.current || !bar.current) { setBase(null); return; }
    const b = bar.current.getBoundingClientRect(), f = field.current.getBoundingClientRect();
    const x1 = f.right - b.left;
    setBase({ x0: Math.max(24, x1 - 560), x1 });
  }, [lensOpen]);
  const lensW = base ? Math.min(680, base.x1 - 24) : 560;

  const crumb = route.page === "campus" ? ["校园", CAMPUS_SUBS[route.sub] ?? "公告"] : [TITLES[route.page] ?? "今日"];
  return (
    <header ref={bar} className={"bar" + (scrolled ? " is-scrolled" : "") + (lensOpen ? " is-lens" : "")}>
      <div ref={crumbs} className="bar-crumbs" style={{ opacity: 1 - q * 0.85, transform: `translateX(${(-q * 14).toFixed(1)}px)`, filter: q > 0.02 ? `blur(${(q * 1.5).toFixed(2)}px)` : undefined }}>
        {crumb.map((c, i) => (
          <span key={i} className={"bar-c" + (i === crumb.length - 1 ? " is-last" : "")}>
            {i > 0 && <i className="bar-sep">/</i>}
            {i === 0 && crumb.length > 1 ? <a href="#/campus" onClick={(e) => { e.preventDefault(); go("campus"); }}>{c}</a> : c}
          </span>
        ))}
        {role === "teacher" && <span className="bar-role">教师身份 · 演示</span>}
      </div>
      <div className="bar-tools">
        <div className="bar-anchor">
          <button ref={field} type="button" className="bar-field" onClick={() => setState({ lensOpen: true })} aria-label="搜索或跳转（⌘K）" style={{ visibility: lensOpen ? "hidden" : undefined }}>
            <Icon kind="lens" size={18} />
            <span className="bar-ph">搜索或跳转…</span>
            <kbd className="bar-kbd">⌘K</kbd>
          </button>
        </div>
        <div className="bar-anchor">
          <button ref={bell} type="button" className={"bar-btn" + (bellOpen ? " is-open" : "")} aria-label={`通知${unread ? `（${unread} 条未读）` : ""}`} onClick={() => setBellOpen(!bellOpen)}>
            <Icon kind="bell" size={20} ping={notify ? unread : undefined} />
            {unread > 0 && <i className="bar-badge t-num">{unread}</i>}
          </button>
          <Grow open={bellOpen} anchor={bell} w={360} h={410} align="end" R={20} fillet={10} onClose={() => setBellOpen(false)}>
            <BellPanel onClose={() => setBellOpen(false)} />
          </Grow>
        </div>
        <button type="button" className="bar-btn" aria-label={dark ? "切换到浅色" : "切换到深色"} onClick={() => setState({ theme: dark ? "light" : "dark" })}>
          <Icon kind="theme" size={20} variant={dark ? 1 : 0} />
        </button>
        <div className="bar-anchor">
          <button ref={me} type="button" className={"bar-me" + (meOpen ? " is-open" : "")} aria-label="账户" onClick={() => setMeOpen(!meOpen)}>
            <span className="bar-av">{role === "teacher" ? "王" : "林"}</span>
          </button>
          <Grow open={meOpen} anchor={me} w={272} h={238} align="end" R={20} fillet={10} onClose={() => setMeOpen(false)}>
            <MePanel onClose={() => setMeOpen(false)} />
          </Grow>
        </div>
      </div>
      {/* the lens is anchored to the whole bar so it can widen into the breadcrumb's room */}
      <Grow open={lensOpen} anchor={field} w={lensW} h={430} align="end" base={base} R={22} fillet={16} onClose={() => setState({ lensOpen: false })} onProgress={setQ} className="lens-grow">
        <Lens width={lensW} />
      </Grow>
      {lensOpen && base && <LensInput x0={base.x0} x1={base.x1} />}
    </header>
  );
}

/* the input lives in the grown base (the field), above the glaze */
let lensQuery = "";
const lensSubs = new Set<(q: string) => void>();
function setLensQuery(q: string) { lensQuery = q; lensSubs.forEach((f) => f(q)); }
function useLensQuery() {
  const [q, setQ] = useState(lensQuery);
  useEffect(() => { lensSubs.add(setQ); return () => { lensSubs.delete(setQ); }; }, []);
  return q;
}
let lensSel = 0;
const selSubs = new Set<(n: number) => void>();
function setLensSel(n: number) { lensSel = n; selSubs.forEach((f) => f(n)); }

function LensInput({ x0, x1 }: { x0: number; x1: number }) {
  const ref = useRef<HTMLInputElement>(null);
  const q = useLensQuery();
  useEffect(() => { setLensQuery(""); setLensSel(0); ref.current?.focus(); }, []);
  return (
    <div className="lens-in" style={{ left: x0, width: x1 - x0 }}>
      <Icon kind="lens" size={18} active />
      <input ref={ref} value={q} placeholder="搜索课程、通知、地点，或输入命令" aria-label="命令透镜"
        onChange={(e) => { setLensQuery(e.target.value); setLensSel(0); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setLensSel(lensSel + 1); }
          if (e.key === "ArrowUp") { e.preventDefault(); setLensSel(Math.max(0, lensSel - 1)); }
          if (e.key === "Enter") { e.preventDefault(); const r = search(lensQuery); const c = r[Math.min(lensSel, r.length - 1)]; if (c) { setState({ lensOpen: false }); c.run(); } }
        }} />
      <kbd className="bar-kbd">esc</kbd>
    </div>
  );
}

function Lens({ width }: { width: number }) {
  const q = useLensQuery();
  const [sel, setSel] = useState(lensSel);
  useEffect(() => { selSubs.add(setSel); return () => { selSubs.delete(setSel); }; }, []);
  const res = useMemo(() => search(q), [q]);
  const n = res.length;
  const si = Math.min(sel, Math.max(0, n - 1));
  const list = useRef<HTMLDivElement>(null);
  const plate = useRef<HTMLDivElement>(null);
  const s = useConst(() => ({ y: spring(0, SP.ui), h: spring(44, SP.ui), init: false }));
  useLayoutEffect(() => {
    const row = list.current?.querySelectorAll<HTMLElement>(".lens-row")[si];
    if (row) { s.y.t = row.offsetTop; s.h.t = row.offsetHeight; if (!s.init) { settle(s.y, s.y.t); s.init = true; } clock.wake(); }
  });
  useTick((dt) => {
    const a = stepS(s.y, dt), b = stepS(s.h, dt);
    if (plate.current) {
      const st = clamp(Math.abs(s.y.v) * 0.02, 0, 10) * clock.intensity;
      plate.current.style.transform = `translate3d(0, ${(s.y.x - st / 2).toFixed(2)}px, 0)`;
      plate.current.style.height = `${(s.h.x + st).toFixed(2)}px`;
      plate.current.style.opacity = n ? "1" : "0";
    }
    return a || b;
  });
  let lastGroup = "";
  return (
    <div className="lens" style={{ width }}>
      <div ref={list} className="lens-list" role="listbox">
        <div ref={plate} className="lens-plate" />
        {res.map((c: Cmd, i) => {
          const head = c.group !== lastGroup ? (lastGroup = c.group) : null;
          return (
            <div key={c.id} className="grow-r" style={{ ["--i" as any]: i }}>
              {head && <div className="lens-g">{head}</div>}
              <button type="button" role="option" aria-selected={i === si} className={"lens-row" + (i === si ? " is-on" : "")}
                onPointerEnter={() => setLensSel(i)} onClick={() => { setState({ lensOpen: false }); c.run(); }}>
                <Icon kind={c.icon} size={18} />
                <span className="lens-t">{c.title}</span>
                {c.meta && <span className="lens-m">{c.meta}</span>}
                {i === si && <kbd className="bar-kbd lens-enter">↵</kbd>}
              </button>
            </div>
          );
        })}
        {!n && <div className="lens-empty grow-r">没有找到“{q}”。试试“专注”“图书馆”“期中”。</div>}
      </div>
      <div className="lens-foot grow-r" style={{ ["--i" as any]: 8 }}>
        <span><kbd className="bar-kbd">↑</kbd><kbd className="bar-kbd">↓</kbd> 选择</span><span><kbd className="bar-kbd">↵</kbd> 打开</span><span className="lens-demo">内容为演示数据</span>
      </div>
    </div>
  );
}

function BellPanel({ onClose }: { onClose: () => void }) {
  const notices = useStore((s) => s.notices);
  return (
    <div className="pop">
      <div className="pop-h grow-r"><b>通知</b><button type="button" className="pop-a" onClick={readAll}>全部已读</button></div>
      <ul className="pop-list">
        {notices.slice(0, 5).map((n, i) => (
          <li key={n.id} className="grow-r" style={{ ["--i" as any]: i + 1 }}>
            <button type="button" className={"pop-row" + (n.unread ? " is-unread" : "")} onClick={(e) => { readNotice(n.id); go("campus/notice"); setState({ inspector: { kind: "notice", id: n.id, from: e.currentTarget.getBoundingClientRect() } }); onClose(); }}>
              <i className="pop-dot" />
              <span className="pop-t">{n.title}</span>
              <span className="pop-m">{n.from} · {n.time}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="pop-f grow-r" style={{ ["--i" as any]: 7 }}><span className="demo-tag">演示</span><button type="button" className="pop-a" onClick={() => { go("campus/notice"); onClose(); }}>查看全部公告</button></div>
    </div>
  );
}

function MePanel({ onClose }: { onClose: () => void }) {
  const role = useStore((s) => s.role);
  const p = role === "teacher" ? { name: TEACHER.name, meta: `${TEACHER.subject} · ${TEACHER.classes.join("、")}` } : { name: STUDENT.name, meta: STUDENT.cls };
  return (
    <div className="pop">
      <div className="pop-me grow-r"><span className="bar-av bar-av--lg">{p.name[0]}</span><span><b>{p.name}</b><small>{p.meta} · 演示身份</small></span></div>
      <button type="button" className="pop-row pop-row--line grow-r" style={{ ["--i" as any]: 1 }} onClick={() => { go("me"); onClose(); }}><span className="pop-t">我的主页与设置</span></button>
      <div className="pop-row pop-row--line grow-r" style={{ ["--i" as any]: 2 }}>
        <span className="pop-t">教师身份（演示）</span>
        <Switch checked={role === "teacher"} onChange={(v) => { setState({ role: v ? "teacher" : "student" }); go(v ? "teacher" : "today"); }} label="教师身份" />
      </div>
      <button type="button" className="pop-row pop-row--line grow-r" style={{ ["--i" as any]: 3 }} onClick={() => { window.open("bench.html", "_self"); }}><span className="pop-t">新旧对照验收台</span></button>
    </div>
  );
}
