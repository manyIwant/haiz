/**
 * 墙 · the wall-light login and the identity wall (HAIZ Native 001).
 *
 * Restores the earlier HAIZ login (a brick wall at night; the lamp warms while you type, flickers
 * and dims on an error, floods the wall on success) and makes it the place identities live:
 *
 *   first launch — the wall is dark; one lamp flickers on and the glass card rises. Every letter
 *     of your name is set into the wall in dots under the lamp. 进入 floods the wall and the app
 *     grows out of the light.
 *   switching — every identity is a lamp of its own colour on the same wall. Tap a lamp (or its
 *     name) and its light takes the wall while the others go down; then the app is that identity.
 *
 * The lamps are pendulums (after the Whitespace "pendant lamp" study, reimplemented): grab one,
 * swing it, throw it; its cone sweeps the bricks. Physics and the wall draw only while something
 * moves, on the app's one clock.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { clock } from "../kernel/motion";
import { Wall, TONES } from "./wall";
import { DotField } from "../ui/DotField";
import { createIdentity, listIdentities, type Identity, type LampTone } from "../identity/repo";
import { activate } from "../identity/session";
import "./wall.css";

const TONE_NAMES: Record<LampTone, string> = { amber: "琥珀", ivory: "月白", jade: "青玉", dusk: "暮紫" };
const TONE_CSS: Record<LampTone, string> = { amber: "#ffbe7a", ivory: "#ffe3c0", jade: "#b8ffd9", dusk: "#dcc4ff" };
const NEXT_TONE: LampTone[] = ["amber", "jade", "ivory", "dusk"];

type Phase = "dark" | "idle" | "typing" | "ready" | "checking" | "error" | "success";
type Lamp = { key: string; fx: number; len: number; th: number; w: number; on: number; target: number; tone: LampTone; grab: boolean; flick: number };

const G = 2400;          // px/s² — a heavy shade on a long cord
const DAMP = 0.55;

export function WallLogin({ mode, onDone, onCancel }: { mode: "first" | "switch"; onDone(id: Identity): void; onCancel?(): void }) {
  const root = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const wallRef = useRef<Wall | null>(null);
  const lamps = useRef<Lamp[]>([]);
  const dirty = useRef(true);
  const [noGL, setNoGL] = useState(false);
  const [ids, setIds] = useState<Identity[]>([]);
  const [form, setForm] = useState(mode === "first");
  const [phase, setPhase] = useState<Phase>("dark");
  const [leaving, setLeaving] = useState(false);
  const [f, setF] = useState({ school: "海南中学", name: "", cls: "", no: "", role: "student" as "student" | "teacher", lamp: "amber" as LampTone, start: "sample" as "sample" | "blank" });
  const [err, setErr] = useState<string | null>(null);
  const phaseRef = useRef(phase); phaseRef.current = phase;
  const flood = useRef({ v: 0, t: 0 });
  const nameRef = useRef<HTMLInputElement>(null);

  // the identities already on this device
  useEffect(() => { listIdentities().then((l) => { setIds(l.sort((a, b) => a.seq - b.seq)); if (!l.length) setForm(true); }).catch(() => {}); }, []);

  // lamps follow the identities (switch) or the form's choice (first launch / a new identity)
  useEffect(() => {
    const list: { key: string; tone: LampTone }[] = form ? [{ key: "new", tone: f.lamp }] : ids.slice(0, 4).map((i) => ({ key: i.id, tone: i.lamp }));
    const n = list.length;
    const prev = new Map(lamps.current.map((l) => [l.key, l]));
    const phone = (root.current?.clientWidth ?? 400) < 720;
    const H = root.current?.clientHeight ?? 800;
    lamps.current = list.map((x, i) => {
      const p = prev.get(x.key);
      const fx = form ? (phone ? 0.5 : 0.34) : n === 1 ? 0.5 : 0.18 + (0.64 * i) / (n - 1);
      const len = H * (form ? (phone ? 0.2 : 0.26) : 0.2 + ((i * 37) % 3) * 0.035);
      return p ? { ...p, fx, len, tone: x.tone } : { key: x.key, fx, len, th: (i % 2 ? -1 : 1) * 0.22, w: 0, on: 0, target: 0, tone: x.tone, grab: false, flick: 0 };
    });
    dirty.current = true; clock.wake();
  }, [ids, form, f.lamp]);

  // light levels follow the phase
  useEffect(() => {
    const L = lamps.current;
    const level = { dark: 0, idle: 0.6, typing: 0.62 + Math.min(0.3, [...f.name].length * 0.05), ready: 1, checking: 0.85, error: 0.22, success: 1.25 }[phase];
    for (const l of L) l.target = form ? level : phase === "success" ? (l.key === pickedRef.current ? 1.3 : 0) : phase === "dark" ? 0 : 0.7;
    if (phase === "error") for (const l of L) l.flick = 0.6;
    clock.wake();
  }, [phase, f.name, form]);

  // the wall and the clock
  useLayoutEffect(() => {
    const el = root.current!;
    let wall: Wall;
    try { wall = new Wall(el, (el.clientWidth < 720 ? 1.35 : 1.5)); } catch { setNoGL(true); return; }
    wallRef.current = wall;
    let t = 0;
    const ro = new ResizeObserver(() => { wall.resize(); placeText(); dirty.current = true; clock.wake(); });
    ro.observe(el);
    const off = clock.add((dt) => {
      const s = dt;
      t += s;
      let moving = false;
      for (const l of lamps.current) {
        if (!l.grab) {
          // a damped pendulum: θ'' = -(g/L) sin θ - c θ'
          const a = -(G / l.len) * Math.sin(l.th) - DAMP * l.w;
          l.w += a * s; l.th += l.w * s;
          if (Math.abs(l.w) > 0.002 || Math.abs(l.th) > 0.002) moving = true; else { l.w = 0; }
        }
        let tgt = l.target;
        if (l.flick > 0) { l.flick = Math.max(0, l.flick - s); tgt *= 0.35 + 0.65 * (Math.sin(t * 61) * Math.sin(t * 23) > 0.1 ? 1 : 0.2); moving = true; }
        if (phaseRef.current === "checking") { tgt *= 0.82 + 0.18 * Math.sin(t * 9); moving = true; }
        const k = tgt > l.on ? 5.5 : 3.2;
        l.on += (tgt - l.on) * Math.min(1, k * s);
        if (Math.abs(tgt - l.on) > 0.003) moving = true; else l.on = tgt;
      }
      const fl = flood.current;
      if (Math.abs(fl.t - fl.v) > 0.002) { fl.v += (fl.t - fl.v) * Math.min(1, 2.6 * s); moving = true; } else fl.v = fl.t;
      if (moving || dirty.current) {
        dirty.current = false;
        const W = wall.size.w;
        wall.lamps = lamps.current.map((l) => ({ x: l.fx * W, len: l.len, angle: l.th, on: l.on, tone: TONES[l.tone] }));
        wall.flood = fl.v;
        wall.draw(t);
        drawFixtures(W);
      }
      return moving;
    });
    // the lamp comes on the way an old lamp does
    const seq = mode === "first" ? [[700, "idle"]] as const : [[250, "idle"]] as const;
    const timers = seq.map(([ms, ph]) => window.setTimeout(() => { for (const l of lamps.current) l.flick = mode === "first" ? 0.9 : 0.25; setPhase(ph); }, ms));
    return () => { off(); ro.disconnect(); timers.forEach(clearTimeout); wall.dispose(); wallRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // the cord, the shade and the bulb: drawn in SVG over the wall, rotated about the ceiling pivot
  function drawFixtures(W: number) {
    const s = svg.current;
    if (!s) return;
    lamps.current.forEach((l, i) => {
      const g = s.children[i] as SVGGElement | undefined;
      if (!g) return;
      g.setAttribute("transform", `translate(${(l.fx * W).toFixed(1)} 0) rotate(${(-l.th * 180 / Math.PI).toFixed(2)})`);
      const glow = g.querySelector(".wl-bulb") as SVGCircleElement | null;
      if (glow) glow.style.opacity = String(Math.min(1, 0.15 + l.on));
    });
  }

  // the name set into the wall under the lamp
  const textOf = () => {
    if (form) return f.name ? [{ text: f.name, size: 64 }, { text: [f.school, f.cls].filter(Boolean).join(" · "), size: 22, weight: 500 }] : [{ text: "HAIZ", size: 74, weight: 700, family: '"Inter", system-ui' }, { text: "点亮属于你的那盏灯", size: 22, weight: 500 }];
    const p = ids.find((i) => i.id === pickedRef.current);
    return p ? [{ text: p.name, size: 64 }, { text: [p.school, p.cls].filter(Boolean).join(" · "), size: 22, weight: 500 }] : [{ text: "选择一盏灯", size: 46 }, { text: "每一盏灯是一个校园身份", size: 20, weight: 500 }];
  };
  function placeText() {
    const w = wallRef.current, el = root.current;
    if (!w || !el) return;
    const phone = el.clientWidth < 720;
    const L = lamps.current[0];
    const cx = form ? (L ? L.fx * el.clientWidth : el.clientWidth / 2) : el.clientWidth / 2;
    const y = form ? (L ? L.len + (phone ? 44 : 110) : 200) : el.clientHeight * (phone ? 0.42 : 0.5);
    w.setText(textOf(), cx, y);
    dirty.current = true; clock.wake();
  }
  const pickedRef = useRef<string | null>(null);
  useEffect(() => { placeText(); });

  // grab, swing, throw
  const drag = useRef<{ i: number; hist: { th: number; t: number }[]; x0: number; y0: number; moved: boolean } | null>(null);
  const angleAt = (l: Lamp, e: React.PointerEvent) => {
    const r = root.current!.getBoundingClientRect();
    const dx = e.clientX - r.left - l.fx * r.width, dy = Math.max(30, e.clientY - r.top);
    return Math.max(-1.25, Math.min(1.25, Math.atan2(dx, dy)));
  };
  const onDown = (i: number) => (e: React.PointerEvent) => {
    const l = lamps.current[i];
    if (!l) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    l.grab = true; l.w = 0;
    drag.current = { i, hist: [{ th: l.th, t: performance.now() }], x0: e.clientX, y0: e.clientY, moved: false };
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const l = lamps.current[d.i];
    if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 6) d.moved = true;
    l.th = angleAt(l, e);
    const now = performance.now();
    d.hist.push({ th: l.th, t: now }); while (d.hist.length > 5) d.hist.shift();
    dirty.current = true; clock.wake();
  };
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    const l = lamps.current[d.i];
    l.grab = false;
    const a = d.hist[0], b = d.hist[d.hist.length - 1];
    l.w = b.t > a.t ? Math.max(-9, Math.min(9, (b.th - a.th) / ((b.t - a.t) / 1000))) : 0;
    clock.wake();
    if (!d.moved && !form) pick(l.key);
    else if (!d.moved && form) nameRef.current?.focus();
    void e;
  };

  // switching: the picked lamp takes the wall
  async function pick(id: string) {
    if (phaseRef.current === "success") return;
    pickedRef.current = id;
    const l = lamps.current.find((x) => x.key === id);
    if (l) l.w += 2.4 * (l.th >= 0 ? 1 : -1) || 2.4;
    setPhase("success");
    flood.current.t = 0.5;
    placeText();
    try {
      const got = await activate(id);
      if (!got) throw new Error("missing");
      window.setTimeout(() => leave(got), 650);
    } catch { setPhase("error"); window.setTimeout(() => setPhase("idle"), 900); }
  }

  // the form
  const nameOk = f.name.trim().length > 0, schoolOk = f.school.trim().length > 0;
  useEffect(() => {
    if (!form || phase === "dark" || phase === "checking" || phase === "success" || phase === "error") return;
    setPhase(nameOk && schoolOk ? "ready" : f.name ? "typing" : "idle");
  }, [f.name, f.school, form, phase, nameOk, schoolOk]);
  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (phase === "checking" || phase === "success") return;
    if (!nameOk || !schoolOk) {
      setErr(!schoolOk ? "school" : "name");
      setPhase("error");
      window.setTimeout(() => { setErr(null); setPhase(f.name ? "typing" : "idle"); }, 900);
      return;
    }
    setPhase("checking");
    try {
      const idn = await createIdentity({ school: f.school.trim(), name: f.name.trim(), cls: f.cls.trim(), no: f.no.trim(), role: f.role, lamp: f.lamp, startFrom: f.start });
      await activate(idn.id);
      setPhase("success");
      flood.current.t = 1;
      for (const l of lamps.current) l.w += 1.6;
      window.setTimeout(() => leave(idn), 900);
    } catch (x) {
      console.warn(x);
      setPhase("error");
      window.setTimeout(() => setPhase("ready"), 900);
    }
  }
  function leave(idn: Identity) {
    setLeaving(true);
    window.setTimeout(() => onDone(idn), 520);
  }
  const newIdentity = () => {
    const used = new Set(ids.map((i) => i.lamp));
    setF((x) => ({ ...x, name: "", cls: "", no: "", lamp: NEXT_TONE.find((t) => !used.has(t)) ?? "amber" }));
    setForm(true);
    setPhase("idle");
  };

  const toneCss = TONE_CSS[f.lamp];
  return (
    <div ref={root} className={`wl wl--${mode}${form ? " is-form" : " is-pick"}${leaving ? " is-leaving" : ""}${noGL ? " no-gl" : ""}`} data-phase={phase}
      style={{ ["--wl-tone" as any]: form ? toneCss : "#ffd9a3" }}
      onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      <svg ref={svg} className="wl-fix" aria-hidden="true">
        {(form ? [{ key: "new", tone: f.lamp }] : ids.slice(0, 4)).map((x, i) => (
          <g key={"key" in x ? x.key : (x as Identity).id} onPointerDown={onDown(i)} style={{ color: TONE_CSS[("tone" in x ? x.tone : (x as Identity).lamp) as LampTone] }}>
            <Fixture len={lamps.current[i]?.len ?? 160} />
          </g>
        ))}
      </svg>

      {!form && (
        <div className="wl-pick">
          <div className="wl-pick-h"><b>校园身份</b><span>点一盏灯切换 · 拖动可摇晃</span></div>
          <ul className="wl-names">
            {ids.map((i) => (
              <li key={i.id}><button type="button" onClick={() => pick(i.id)} style={{ ["--c" as any]: TONE_CSS[i.lamp] }}>
                <i /><span className="wl-n">{i.name}</span><span className="wl-s">{i.school}{i.cls ? " · " + i.cls : ""}</span>
              </button></li>
            ))}
          </ul>
          <div className="wl-pick-a">
            <button type="button" className="wl-btn" onClick={newIdentity}>添一盏灯</button>
            {onCancel && <button type="button" className="wl-btn wl-btn--ghost" onClick={onCancel}>返回</button>}
          </div>
        </div>
      )}

      {form && (
        <form className="wl-card" onSubmit={submit} noValidate>
          <div className="wl-card-h">
            <b>{ids.length ? "新的校园身份" : "欢迎来到 HAIZ"}</b>
            <span>身份只保存在这台设备上，不连接任何服务器。</span>
          </div>
          <DotField label="学校" value={f.school} onChange={(v) => setF({ ...f, school: v })} error={err === "school"} enterKeyHint="next" />
          <DotField ref={nameRef} label="姓名" value={f.name} onChange={(v) => setF({ ...f, name: v })} error={err === "name"} placeholder="写下你的名字" enterKeyHint="next" />
          <div className="wl-row">
            <DotField label="班级" value={f.cls} onChange={(v) => setF({ ...f, cls: v })} placeholder="高二（3）班" dots={12} />
            <DotField label="学号" value={f.no} onChange={(v) => setF({ ...f, no: v })} inputMode="numeric" dots={12} />
          </div>
          <div className="wl-opts">
            <div className="wl-seg" role="radiogroup" aria-label="身份">
              {(["student", "teacher"] as const).map((r) => <button key={r} type="button" role="radio" aria-checked={f.role === r} className={f.role === r ? "is-on" : ""} onClick={() => setF({ ...f, role: r })}>{r === "student" ? "学生" : "教师"}</button>)}
            </div>
            <div className="wl-tones" role="radiogroup" aria-label="灯色">
              {(Object.keys(TONE_NAMES) as LampTone[]).map((t) => <button key={t} type="button" role="radio" aria-checked={f.lamp === t} aria-label={TONE_NAMES[t]} title={TONE_NAMES[t]} className={f.lamp === t ? "is-on" : ""} style={{ ["--c" as any]: TONE_CSS[t] }} onClick={() => setF({ ...f, lamp: t })} />)}
            </div>
          </div>
          <div className="wl-seg wl-seg--wide" role="radiogroup" aria-label="起始内容">
            <button type="button" role="radio" aria-checked={f.start === "sample"} className={f.start === "sample" ? "is-on" : ""} onClick={() => setF({ ...f, start: "sample" })}>带示例课表与任务</button>
            <button type="button" role="radio" aria-checked={f.start === "blank"} className={f.start === "blank" ? "is-on" : ""} onClick={() => setF({ ...f, start: "blank" })}>从空白开始</button>
          </div>
          <div className="wl-card-a">
            {ids.length > 0 && <button type="button" className="wl-btn wl-btn--ghost" onClick={() => { setForm(false); setPhase("idle"); }}>已有身份</button>}
            <button type="submit" className="wl-go" disabled={phase === "checking" || phase === "success"}>
              <span>{phase === "checking" ? "点灯中…" : phase === "success" ? "欢迎" : "点亮 · 进入"}</span>
            </button>
          </div>
        </form>
      )}
      {noGL && <div className="wl-nogl">这台设备没有可用的 WebGL，灯墙以静态方式显示。</div>}
    </div>
  );
}

/** a pendant lamp hanging from the ceiling at (0,0), drawn downward along +y */
function Fixture({ len }: { len: number }) {
  const y = len;
  return (
    <>
      <line x1="0" y1="-20" x2="0" y2={y - 26} className="wl-cord" />
      <path d={`M -7 ${y - 28} h 14 v 6 h -14 z`} className="wl-cap" />
      <path d={`M -9 ${y - 22} C -12 ${y - 10}, -30 ${y - 4}, -34 ${y + 6} L 34 ${y + 6} C 30 ${y - 4}, 12 ${y - 10}, 9 ${y - 22} Z`} className="wl-shade" />
      <path d={`M -30 ${y + 5} L 30 ${y + 5}`} className="wl-rim" />
      <circle cx="0" cy={y + 8} r="9" className="wl-bulb" />
      <circle cx="0" cy={y} r="44" className="wl-hit" />
    </>
  );
}
