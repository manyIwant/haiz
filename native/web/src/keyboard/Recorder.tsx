/**
 * 语音 · the liquid-glass recorder (HAIZ Native 001, after the Whitespace "liquid glass recorder"
 * study, reimplemented). The keyboard's microphone key opens a glass capsule above the keys; a
 * drop of light inside it breathes with your voice, and the words appear as they are recognised.
 * 完成 puts them into the field; 取消 drops them.
 *
 * Android: the phone's own speech recognition service, streaming (HaizVoice). Without one, the
 * system voice screen. In a browser: the Web Speech API where it exists.
 *
 * The drop is one SVG path of 48 points, its radius a sum of a few springs driven by the input
 * level; it is drawn on the app clock only while the capsule is open.
 */
import { useEffect, useRef, useState } from "react";
import { clock } from "../kernel/motion";
import { HaizVoice, isNative, pushBack } from "../platform/native";
import { insert, isEditable, type Field } from "./edit";
import "./recorder.css";

type Phase = "starting" | "listening" | "speech" | "thinking" | "done" | "error";

export function Recorder() {
  const [open, setOpen] = useState(false);
  const target = useRef<Field | null>(null);
  useEffect(() => {
    const f = (e: Event) => { const t = (e as CustomEvent).detail?.target; if (isEditable(t)) { target.current = t; setOpen(true); } };
    window.addEventListener("haiz:voice", f);
    return () => window.removeEventListener("haiz:voice", f);
  }, []);
  if (!open) return null;
  return <Capsule target={target.current} onClose={() => { setOpen(false); target.current?.focus(); }} />;
}

function Capsule({ target, onClose }: { target: Field | null; onClose(): void }) {
  const [phase, setPhase] = useState<Phase>("starting");
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");
  const path = useRef<SVGPathElement>(null);
  const level = useRef(0);
  const final = useRef("");
  const closing = useRef(false);

  // the drop
  useEffect(() => {
    const N = 48, modes = [2, 3, 5, 7].map((k, i) => ({ k, a: 0, v: 0, ph: i * 1.7 }));
    let t = 0, base = 0;
    const off = clock.add((dt) => {
      const s = dt; t += s;
      const L = level.current;
      base += ((0.32 + L * 0.5) - base) * Math.min(1, s * 8);
      modes.forEach((m, i) => {
        const target = L * (0.12 / (i + 1)) * (1 + Math.sin(t * (1.3 + i * 0.7) + m.ph));
        m.v += ((target - m.a) * 160 - m.v * 14) * s; m.a += m.v * s;
      });
      let d = "";
      for (let j = 0; j <= N; j++) {
        const th = (j / N) * Math.PI * 2;
        let r = base + 0.025 * Math.sin(t * 1.6 + th * 2);
        for (const m of modes) r += m.a * Math.sin(th * m.k + t * (0.8 + m.k * 0.15) + m.ph);
        const x = 50 + Math.cos(th) * r * 40, y = 50 + Math.sin(th) * r * 40;
        d += (j ? "L" : "M") + x.toFixed(2) + " " + y.toFixed(2);
      }
      path.current?.setAttribute("d", d + "Z");
      level.current *= Math.pow(0.04, s);      // levels decay between events
      return true;
    });
    return off;
  }, []);

  // listening
  useEffect(() => {
    const subs: Promise<{ remove(): Promise<void> }>[] = [];
    let web: any = null;
    const done = (txt: string) => { final.current = txt; setText(txt); setPhase("done"); };
    (async () => {
      if (isNative()) {
        subs.push(HaizVoice.addListener("level", (p) => { level.current = Math.max(level.current, Math.min(1, Math.max(0, (p.db + 2) / 12))); }));
        subs.push(HaizVoice.addListener("partial", (p) => { if (p.text) setText(p.text); }));
        subs.push(HaizVoice.addListener("final", (p) => done(p.text)));
        subs.push(HaizVoice.addListener("state", (p) => setPhase(p.state as Phase)));
        subs.push(HaizVoice.addListener("error", (p) => { setPhase("error"); setMsg(p.code === 7 ? "没有听清，再说一次？" : p.code === 9 ? "没有麦克风权限" : `识别出错（${p.code}）`); }));
        try {
          const r = await HaizVoice.start({ lang: "zh-CN" });
          if (r.mode === "system") { if (r.text) { done(r.text); commit(r.text); } else onClose(); }
        } catch (e: any) { setPhase("error"); setMsg(e?.message ?? "语音不可用"); }
        return;
      }
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SR) { setPhase("error"); setMsg("这个浏览器没有语音识别；Android 安装包里可用。"); return; }
      web = new SR(); web.lang = "zh-CN"; web.interimResults = true; web.continuous = false;
      web.onstart = () => setPhase("listening");
      web.onspeechstart = () => setPhase("speech");
      web.onresult = (e: any) => { let s = ""; for (const r of e.results) s += r[0].transcript; setText(s); level.current = Math.min(1, level.current + 0.5); if (e.results[e.results.length - 1].isFinal) done(s); };
      web.onerror = (e: any) => { setPhase("error"); setMsg(e.error === "not-allowed" ? "没有麦克风权限" : "没有听清，再说一次？"); };
      web.start();
    })();
    return () => { subs.forEach((p) => p.then((h) => h.remove())); if (isNative()) void HaizVoice.cancel().catch(() => {}); try { web?.abort(); } catch { /* gone */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => pushBack(onClose), [onClose]);

  function commit(txt = final.current || text) {
    if (closing.current) return;
    closing.current = true;
    if (txt && target) insert(target, txt);
    onClose();
  }
  const finish = async () => {
    if (phase === "done" || phase === "error") return commit();
    setPhase("thinking");
    if (isNative()) await HaizVoice.stop().catch(() => {});
    window.setTimeout(() => commit(), 900);
  };

  const label = { starting: "准备中…", listening: "请说话", speech: "正在听", thinking: "识别中…", done: "完成", error: msg || "出错了" }[phase];
  return (
    <div className="vrec" data-phase={phase} role="dialog" aria-label="语音输入">
      <div className="vrec-cap">
        <svg viewBox="0 0 100 100" className="vrec-drop" aria-hidden="true">
          <defs>
            <radialGradient id="vrecG" cx="38%" cy="32%" r="75%"><stop offset="0" stopColor="#fff" stopOpacity=".95" /><stop offset=".35" stopColor="var(--vrec-c)" stopOpacity=".9" /><stop offset="1" stopColor="var(--vrec-c)" stopOpacity=".25" /></radialGradient>
          </defs>
          <path ref={path} fill="url(#vrecG)" />
        </svg>
        <div className="vrec-t">
          <b>{label}</b>
          <p aria-live="polite">{text || (phase === "error" ? "" : "说一句话，文字会出现在这里")}</p>
        </div>
        <div className="vrec-a">
          <button type="button" className="vrec-x" onPointerDown={(e) => e.preventDefault()} onClick={onClose}>取消</button>
          <button type="button" className="vrec-ok" onPointerDown={(e) => e.preventDefault()} onClick={finish} disabled={phase === "starting"}>{phase === "done" ? "插入" : "完成"}</button>
        </div>
      </div>
    </div>
  );
}
