/**
 * HAIZ 键盘 · the liquid-glass keyboard (HAIZ Native 001).
 *
 * The app's own keyboard, drawn in the same material as the dock: a sheet of glass that rises
 * from the bottom edge with the app's spring, keys that are small lenses, and a row of dots along
 * its top edge that ripples out from every key you touch (after the Whitespace "dot form" study).
 *
 * - 拼音 through librime (luna_pinyin) in a worker; candidates as you type, partial selection,
 *   the space bar takes the first candidate, ⏎ keeps the letters
 * - English with shift and caps lock, 123 and #+= with Chinese or Western punctuation
 * - hold ⌫ to repeat, and after a moment it deletes by words
 * - drag along the space bar to move the caret; ◀ ▶ ⇤ ⇥ and 全选 in the tool row
 * - 系统 hands the field to the phone's own keyboard (long-press it for the system picker); the
 *   preference is kept per identity
 *
 * Performance: keys are rendered once per layout; a key press is handled by one delegated
 * pointerdown and changes only the candidate row's state. The engine runs off the main thread
 * and lookups are coalesced, so continuous typing never waits for the dictionary.
 */
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { getState, setState, useStore } from "../app/store";
import { HaizNative, isNative, onInsets } from "../platform/native";
import { isEditable, insert, backspace, move, moveTo, selectAll, enter, type Field } from "./edit";
import { warm, lookup, pick, clear, engineFailed, type PyState } from "./pinyin";
import "./keyboard.css";

type Mode = "zh" | "en" | "num" | "sym";
const LETTERS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const NUM_ZH = ["1234567890", "-/：；（）￥@“”", "。，、？！."];
const NUM_EN = ["1234567890", "-/:;()$&@\"", ".,?!'"];
const SYM_ZH = ["【】｛｝#%^*+=", "_\\|～《》€£·…", "。，、？！'"];
const SYM_EN = ["[]{}#%^*+=", "_\\|~<>€£•…", ".,?!'"];

const wantsHaiz = () => getState().keyboard === "haiz" && (isNative() || /[?&]kb=1/.test(location.search) || matchMedia("(pointer: coarse)").matches);

export function HaizKeyboard() {
  const pref = useStore((s) => s.keyboard);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("zh");
  const [shift, setShift] = useState<0 | 1 | 2>(0);
  const [comp, setComp] = useState<{ preedit: string; cands: string[]; loading?: boolean } | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [sysChip, setSysChip] = useState(false);
  const target = useRef<Field | null>(null);
  const buf = useRef("");
  const root = useRef<HTMLDivElement>(null);
  const ripple = useRef<HTMLDivElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const zhRef = useRef<Mode>("zh");               // the letters mode to return to from 123

  /* ---------------- which field ---------------- */
  useEffect(() => {
    const down = (e: PointerEvent) => {
      const t = e.target;
      if (isEditable(t) && wantsHaiz()) { if (!t.hasAttribute("data-im")) t.setAttribute("data-im", t.getAttribute("inputmode") ?? ""); t.setAttribute("inputmode", "none"); }
    };
    const focusIn = (e: FocusEvent) => {
      const t = e.target;
      if (!isEditable(t)) return;
      if (!wantsHaiz()) { setSysChip(isNative() && getState().keyboard === "system"); return; }
      if (!t.hasAttribute("data-im")) t.setAttribute("data-im", t.getAttribute("inputmode") ?? "");
      t.setAttribute("inputmode", "none");
      if (isNative()) void HaizNative.systemKeyboard({ show: false }).catch(() => {});
      attach(t);
    };
    const focusOut = (e: FocusEvent) => {
      if (e.target !== target.current) { setSysChip(false); return; }
      const to = e.relatedTarget as Node | null;
      if (to && root.current?.contains(to)) return;
      window.setTimeout(() => { if (document.activeElement !== target.current) detach(); }, 60);
    };
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("focusin", focusIn);
    document.addEventListener("focusout", focusOut);
    return () => { document.removeEventListener("pointerdown", down, true); document.removeEventListener("focusin", focusIn); document.removeEventListener("focusout", focusOut); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function attach(t: Field) {
    if (target.current !== t) { void commitRaw(); }
    target.current = t;
    const type = t instanceof HTMLInputElement ? t.type : "textarea";
    const im = t.getAttribute("data-im");
    if (type === "number" || type === "tel" || im === "numeric" || im === "decimal" || im === "tel") setMode("num");
    else if (type === "email" || type === "url" || type === "password") setMode(zhRef.current = "en");
    else setMode(zhRef.current === "en" ? "en" : "zh");
    setShift(0);
    setOpen(true);
    void warm().catch(() => {});
    window.setTimeout(() => reveal(t), 260);
  }
  function detach() {
    void commitRaw();
    setOpen(false);
    setExpanded(false);
    target.current = null;
  }
  function reveal(t: Field) {
    const kb = root.current?.offsetHeight ?? 0;
    const r = t.getBoundingClientRect();
    const limit = innerHeight - kb - 20;
    if (r.bottom > limit) {
      const sc = t.closest(".sheet-body, .det-body, [data-scroll]") as HTMLElement | null;
      if (sc) sc.scrollBy({ top: r.bottom - limit, behavior: "smooth" }); else window.scrollBy({ top: r.bottom - limit, behavior: "smooth" });
    }
  }

  // the space the keyboard takes, for layouts that sit above it
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const set = () => document.documentElement.style.setProperty("--kb", open ? el.offsetHeight + "px" : "0px");
    set();
    const ro = new ResizeObserver(set); ro.observe(el);
    document.documentElement.classList.toggle("has-kb", open);
    return () => ro.disconnect();
  }, [open]);

  // the switch-back chip above the system keyboard
  useEffect(() => { const off = onInsets((i) => { if (i.ime === 0) setSysChip(false); else if (getState().keyboard === "system" && isEditable(document.activeElement)) setSysChip(true); }); return () => { off(); }; }, []);
  useEffect(() => { if (pref === "system" && open) toSystem(false); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [pref]);

  /* ---------------- composition ---------------- */
  const onState = useCallback((s: PyState, q: string) => {
    if (q !== buf.current) return;
    if (!s) { if (buf.current) setComp({ preedit: buf.current, cands: engineFailed() ? [buf.current] : [], loading: !engineFailed() }); else setComp(null); return; }
    setComp({ preedit: s.preedit || buf.current, cands: s.candidates });
  }, []);
  function typeLetter(ch: string) {
    const t = target.current;
    if (!t) return;
    if (mode === "zh" && /^[a-z]$/.test(ch) && !engineFailed()) {
      buf.current += ch;
      setComp((c) => ({ preedit: buf.current, cands: c?.cands ?? [], loading: !c }));
      lookup(buf.current, onState);
      return;
    }
    insert(t, ch);
  }
  async function choose(i: number) {
    const t = target.current;
    if (!t || !comp) return;
    const s = await pick(i).catch(() => null);
    if (!s) { insert(t, comp.cands[i] ?? ""); buf.current = ""; setComp(null); return; }
    if (s.committed) { insert(t, s.committed); buf.current = ""; setComp(null); setExpanded(false); }
    else if (s.preedit) setComp({ preedit: s.preedit, cands: s.candidates });
    else { buf.current = ""; setComp(null); }
  }
  async function commitRaw() {
    if (!buf.current) return;
    const t = target.current, raw = buf.current;
    buf.current = ""; setComp(null); setExpanded(false);
    await clear();
    if (t) insert(t, raw);
  }
  function delOne(word: boolean) {
    const t = target.current;
    if (!t) return;
    if (buf.current) {
      buf.current = buf.current.slice(0, -1);
      if (!buf.current) { setComp(null); setExpanded(false); void clear(); }
      else { setComp((c) => c && { ...c, preedit: buf.current }); lookup(buf.current, onState); }
      return;
    }
    backspace(t, word);
  }

  /* ---------------- system keyboard ---------------- */
  function toSystem(savePref = true) {
    const t = target.current;
    void commitRaw();
    if (savePref) setState({ keyboard: "system" });
    setOpen(false);
    if (t) {
      const im = t.getAttribute("data-im");
      if (im) t.setAttribute("inputmode", im); else t.removeAttribute("inputmode");
      t.removeAttribute("data-im");
      t.blur(); window.setTimeout(() => { t.focus(); if (isNative()) void HaizNative.systemKeyboard({ show: true }).catch(() => {}); }, 30);
    }
  }
  function toHaiz() {
    setState({ keyboard: "haiz" });
    setSysChip(false);
    const t = document.activeElement;
    if (isEditable(t)) {
      t.setAttribute("data-im", t.getAttribute("inputmode") ?? ""); t.setAttribute("inputmode", "none");
      if (isNative()) void HaizNative.systemKeyboard({ show: false }).catch(() => {});
      window.setTimeout(() => attach(t), 0);
    }
  }

  /* ---------------- keys ---------------- */
  const held = useRef<{ timer: number; rep: number; t0: number } | null>(null);
  const space = useRef<{ x: number; moved: boolean; id: number } | null>(null);
  const lastShift = useRef(0);
  const stopHold = () => { if (held.current) { clearTimeout(held.current.timer); clearInterval(held.current.rep); held.current = null; } };

  const feedback = (el: HTMLElement, ch?: string) => {
    const r = el.getBoundingClientRect(), kb = root.current!.getBoundingClientRect();
    const x = r.left + r.width / 2 - kb.left;
    ripple.current?.style.setProperty("--x", x.toFixed(0) + "px");
    ripple.current?.animate([{ opacity: 1, ["--r" as any]: "0px" }, { opacity: 0, ["--r" as any]: "220px" }], { duration: 520, easing: "cubic-bezier(.2,.7,.3,1)" });
    const p = pop.current;
    if (p && ch) {
      p.textContent = ch;
      p.style.transform = `translate(${(r.left - kb.left + r.width / 2).toFixed(0)}px, ${(r.top - kb.top).toFixed(0)}px)`;
      p.classList.add("is-on");
    }
    try { navigator.vibrate?.(6); } catch { /* not allowed */ }
  };
  const hidePop = () => pop.current?.classList.remove("is-on");

  const onDown = (e: React.PointerEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-k]");
    if (!el) return;
    e.preventDefault();
    const k = el.dataset.k!;
    const t = target.current;
    if (!t) return;
    el.classList.add("is-down");
    const letter = k.length === 1 || /^[^\w]{1,2}$/.test(k);
    feedback(el, letter && k !== " " ? (mode !== "zh" && shift ? k.toUpperCase() : k) : undefined);
    el.setPointerCapture?.(e.pointerId);
    switch (k) {
      case "del":
        delOne(false);
        held.current = { t0: performance.now(), rep: 0, timer: window.setTimeout(() => {
          held.current!.rep = window.setInterval(() => delOne(performance.now() - held.current!.t0 > 1600), 65);
        }, 380) };
        return;
      case "shift": {
        const now = performance.now();
        setShift((s) => (now - lastShift.current < 320 ? 2 : s ? 0 : 1));
        lastShift.current = now;
        return;
      }
      case "space": space.current = { x: e.clientX, moved: false, id: e.pointerId }; return;
      case "lang":
        void commitRaw();
        held.current = { t0: performance.now(), rep: 0, timer: window.setTimeout(() => { held.current = null; if (isNative()) void HaizNative.pickInputMethod(); }, 600) };
        return;
      case "enter": if (buf.current) void commitRaw(); else enter(t); return;
      case "123": void commitRaw(); setMode("num"); return;
      case "sym": setMode("sym"); return;
      case "abc": setMode(zhRef.current); return;
      case "left": void commitRaw(); move(t, -1); return;
      case "right": void commitRaw(); move(t, 1); return;
      case "home": void commitRaw(); moveTo(t, "start"); return;
      case "end": void commitRaw(); moveTo(t, "end"); return;
      case "all": void commitRaw(); selectAll(t); return;
      case "sys": toSystem(); return;
      case "hide": void commitRaw(); t.blur(); return;
      case "voice": void commitRaw(); window.dispatchEvent(new CustomEvent("haiz:voice", { detail: { target: t } })); return;
      case "more": setExpanded((x) => !x); return;
    }
    if (letter) {
      const ch = (mode === "en" || (mode === "zh" && shift)) && shift ? k.toUpperCase() : k;
      if (mode === "zh" && shift) { void commitRaw().then(() => insert(t, ch)); }
      else if (mode === "zh" && !/^[a-z]$/.test(k) && buf.current) { void (async () => { await choose(0); insert(t, k); })(); }
      else typeLetter(ch);
      if (shift === 1) setShift(0);
    }
  };
  const onMove = (e: React.PointerEvent) => {
    const s = space.current, t = target.current;
    if (!s || !t || s.id !== e.pointerId || buf.current) return;
    const dx = e.clientX - s.x;
    if (Math.abs(dx) >= 11) { move(t, Math.trunc(dx / 11)); s.x += Math.trunc(dx / 11) * 11; s.moved = true; root.current?.classList.add("is-cursor"); }
  };
  const onUp = (e: React.PointerEvent) => {
    root.current?.querySelectorAll(".is-down").forEach((x) => x.classList.remove("is-down"));
    hidePop();
    const k = (e.target as HTMLElement).closest<HTMLElement>("[data-k]")?.dataset.k;
    if (k === "lang" && held.current) { stopHold(); setMode((m) => { const n = m === "zh" ? "en" : "zh"; zhRef.current = n; return n; }); return; }
    stopHold();
    const s = space.current;
    if (s && s.id === e.pointerId) {
      space.current = null;
      root.current?.classList.remove("is-cursor");
      if (!s.moved && target.current) { if (buf.current && comp?.cands.length) void choose(0); else if (buf.current) void commitRaw(); else insert(target.current, " "); }
    }
  };

  const letters = mode === "zh" || mode === "en";
  const rows = letters ? LETTERS : mode === "num" ? (zhRef.current === "zh" ? NUM_ZH : NUM_EN) : (zhRef.current === "zh" ? SYM_ZH : SYM_EN);
  const caps = mode === "en" && shift > 0;
  const enterLabel = (() => { const h = target.current?.enterKeyHint; return h === "search" ? "搜索" : h === "go" ? "前往" : h === "send" ? "发送" : h === "next" ? "下一项" : h === "done" ? "完成" : target.current instanceof HTMLTextAreaElement ? "换行" : "确定"; })();

  return (
    <>
      <div ref={root} className={"hkb" + (open ? " is-open" : "") + (expanded ? " is-expanded" : "")} data-mode={mode} aria-hidden={!open}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onMouseDown={(e) => e.preventDefault()} onContextMenu={(e) => e.preventDefault()}>
        <div ref={ripple} className="hkb-dots" aria-hidden="true" />
        <Bar comp={comp} expanded={expanded} onPick={choose} />
        {!expanded && <Keys rows={rows} mode={mode} caps={caps} shift={shift} enterLabel={enterLabel} />}
        <div ref={pop} className="hkb-pop" aria-hidden="true" />
      </div>
      {sysChip && pref === "system" && <button type="button" className="hkb-chip" onPointerDown={(e) => { e.preventDefault(); toHaiz(); }}>HAIZ 键盘</button>}
    </>
  );
}

/* the candidate row, or the tool row when nothing is being composed */
const Bar = memo(function Bar({ comp, expanded, onPick }: { comp: { preedit: string; cands: string[]; loading?: boolean } | null; expanded: boolean; onPick(i: number): void }) {
  const tap = useRef<{ x: number; y: number; i: number } | null>(null);
  if (!comp) return (
    <div className="hkb-bar hkb-tools">
      <button type="button" data-k="voice" aria-label="语音输入"><svg viewBox="0 0 20 20"><rect x="7" y="2.5" width="6" height="10" rx="3" /><path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v2.5" /></svg></button>
      <button type="button" data-k="home" aria-label="到开头"><svg viewBox="0 0 20 20"><path d="M5 4v12M15 5l-6 5 6 5" /></svg></button>
      <button type="button" data-k="left" aria-label="左移"><svg viewBox="0 0 20 20"><path d="M12.5 5l-5 5 5 5" /></svg></button>
      <button type="button" data-k="right" aria-label="右移"><svg viewBox="0 0 20 20"><path d="M7.5 5l5 5-5 5" /></svg></button>
      <button type="button" data-k="end" aria-label="到末尾"><svg viewBox="0 0 20 20"><path d="M15 4v12M5 5l6 5-6 5" /></svg></button>
      <button type="button" data-k="all" className="hkb-txt">全选</button>
      <button type="button" data-k="sys" className="hkb-txt" aria-label="切换到系统输入法（长按地球键选择）">系统</button>
      <button type="button" data-k="hide" aria-label="收起键盘"><svg viewBox="0 0 20 20"><path d="M5 8l5 5 5-5" /></svg></button>
    </div>
  );
  return (
    <div className="hkb-bar hkb-cands">
      <div className="hkb-pre">{comp.preedit}{comp.loading && <span className="hkb-load"> · 词库载入中</span>}</div>
      <div className={"hkb-list" + (expanded ? " is-grid" : "")}
        onPointerDown={(e) => { const b = (e.target as HTMLElement).closest<HTMLElement>("[data-c]"); if (b) { e.stopPropagation(); e.preventDefault(); tap.current = { x: e.clientX, y: e.clientY, i: +b.dataset.c! }; b.classList.add("is-down"); } }}
        onPointerUp={(e) => { const t = tap.current; tap.current = null; (e.currentTarget as HTMLElement).querySelectorAll(".is-down").forEach((x) => x.classList.remove("is-down")); if (t && Math.hypot(e.clientX - t.x, e.clientY - t.y) < 10) { e.stopPropagation(); onPick(t.i); } }}
        onPointerCancel={() => { tap.current = null; }}>
        {comp.cands.slice(0, expanded ? 100 : 30).map((c, i) => <button type="button" key={i + c} data-c={i} className={i === 0 ? "is-first" : ""}>{c}</button>)}
      </div>
      {comp.cands.length > 6 && <button type="button" className="hkb-more" data-k="more" aria-label={expanded ? "收起候选" : "更多候选"}><svg viewBox="0 0 20 20"><path d={expanded ? "M5 12l5-5 5 5" : "M5 8l5 5 5-5"} /></svg></button>}
    </div>
  );
});

const Keys = memo(function Keys({ rows, mode, caps, shift, enterLabel }: { rows: string[]; mode: Mode; caps: boolean; shift: number; enterLabel: string }) {
  const letters = mode === "zh" || mode === "en";
  const ch = (c: string) => (caps || (mode === "zh" && shift) ? c.toUpperCase() : c);
  return (
    <div className="hkb-keys">
      <div className="hkb-row">{[...rows[0]].map((c) => <button type="button" key={c} data-k={c} className="hkb-k">{ch(c)}</button>)}</div>
      <div className={"hkb-row" + (letters ? " hkb-row--inset" : "")}>{[...rows[1]].map((c) => <button type="button" key={c} data-k={c} className="hkb-k">{ch(c)}</button>)}</div>
      <div className="hkb-row">
        {letters
          ? <button type="button" data-k="shift" className={"hkb-k hkb-fn hkb-w15" + (shift ? " is-on" : "") + (shift === 2 ? " is-lock" : "")} aria-label="大写"><svg viewBox="0 0 20 20"><path d="M10 3l6.5 7H13v6H7v-6H3.5z" />{shift === 2 && <path d="M7 18h6" />}</svg></button>
          : <button type="button" data-k={mode === "num" ? "sym" : "123"} className="hkb-k hkb-fn hkb-w15">{mode === "num" ? "#+=" : "123"}</button>}
        {[...rows[2]].map((c) => <button type="button" key={c} data-k={c} className={"hkb-k" + (letters ? "" : " hkb-w12")}>{ch(c)}</button>)}
        <button type="button" data-k="del" className="hkb-k hkb-fn hkb-w15" aria-label="删除"><svg viewBox="0 0 20 20"><path d="M7 4.5h9.5v11H7L2.5 10z" /><path d="M9.5 7.5l5 5m0-5l-5 5" /></svg></button>
      </div>
      <div className="hkb-row">
        <button type="button" data-k={letters ? "123" : "abc"} className="hkb-k hkb-fn hkb-w15">{letters ? "123" : mode === "sym" || mode === "num" ? "拼音" : "ABC"}</button>
        <button type="button" data-k="lang" className="hkb-k hkb-fn hkb-w12" aria-label="中英切换，长按选择输入法">{mode === "en" ? "英" : "中"}<small>{mode === "en" ? "中" : "英"}</small></button>
        <button type="button" data-k={mode === "en" ? "," : "，"} className="hkb-k hkb-fn">{mode === "en" ? "," : "，"}</button>
        <button type="button" data-k="space" className="hkb-k hkb-space">{mode === "zh" ? "拼音" : mode === "en" ? "English" : "空格"}</button>
        <button type="button" data-k={mode === "en" ? "." : "。"} className="hkb-k hkb-fn">{mode === "en" ? "." : "。"}</button>
        <button type="button" data-k="enter" className="hkb-k hkb-enter hkb-w2">{enterLabel}</button>
      </div>
    </div>
  );
});

