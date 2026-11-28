/**
 * 更新 · the update sheet. Version, notes and size; one liquid line for 检查 · 下载 · 校验 · 安装;
 * pause, resume, retry; and the system installer at the end.
 */
import { useEffect, useState } from "react";
import { setState } from "../app/store";
import { LiquidTags } from "../ui/LiquidTags";
import { check, download, pause, install, discard, getUpdate, onUpdate, fmtBytes, type UpdState } from "./updater";
import { pushBack } from "../platform/native";
import "./update.css";

const STEP: Record<string, number> = { idle: 0, checking: 0, uptodate: 4, available: 1, downloading: 1, paused: 1, verifying: 2, ready: 3, installing: 3, error: 1, unsupported: 0 };

export function UpdateSheet() {
  const [s, setS] = useState<UpdState>(getUpdate());
  const [closing, setClosing] = useState(false);
  const close = () => { setClosing(true); window.setTimeout(() => setState({ updateOpen: false }), 280); };
  useEffect(() => onUpdate(setS), []);
  useEffect(() => { if (s.phase === "idle" || s.phase === "error" && !s.manifest) void check(true); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => pushBack(close), []);

  const m = s.manifest;
  const step = STEP[s.phase] ?? 0;
  const frac = s.phase === "checking" ? 0.5 : s.phase === "downloading" || s.phase === "paused" ? (s.total ? s.received / s.total : 0) : s.phase === "verifying" ? 0.6 : s.phase === "installing" ? 0.5 : 0;
  const ltState = s.phase === "error" ? "error" : s.phase === "paused" ? "paused" : s.phase === "uptodate" ? "done" : "ok";
  const eta = s.bps > 0 && s.total > s.received ? Math.ceil((s.total - s.received) / s.bps) : 0;

  return (
    <div className={"upd" + (closing ? " is-closing" : "")} role="dialog" aria-modal="true" aria-label="检查更新">
      <button type="button" className="upd-scrim" aria-label="关闭" onClick={close} />
      <section className="upd-card glaze">
        <header className="upd-h">
          <div><b>{s.phase === "uptodate" ? "已是最新版本" : m && s.phase !== "checking" ? `HAIZ ${m.versionName}` : "检查更新"}</b>
            <span>当前 {s.installed ? `${s.installed.versionName}（${s.installed.versionCode}）` : "—"}{m && s.phase !== "uptodate" ? ` → ${m.versionCode}` : ""}</span></div>
          <button type="button" className="upd-x" onClick={close} aria-label="关闭">×</button>
        </header>

        {s.phase !== "unsupported" && <LiquidTags steps={["检查", "下载", "校验", "安装"]} active={step} progress={frac} state={ltState} className="upd-tags" />}

        <div className="upd-meta">
          {s.phase === "downloading" && <span>{fmtBytes(s.received)} / {fmtBytes(s.total)} · {fmtBytes(s.bps)}/s{eta ? ` · 约 ${eta} 秒` : ""}{s.attempt ? ` · 重试第 ${s.attempt} 次` : ""}</span>}
          {s.phase === "paused" && <span>已暂停 · {fmtBytes(s.received)} / {fmtBytes(s.total)}，继续时从断点接着下</span>}
          {s.phase === "verifying" && <span>正在核对 SHA-256 与大小…</span>}
          {s.phase === "ready" && <span>安装包已校验（{fmtBytes(m?.sizeBytes ?? 0)}，同一签名）。覆盖安装会保留全部身份与数据。</span>}
          {s.phase === "available" && m && <span>大小 {fmtBytes(m.sizeBytes)}{m.publishedAt ? ` · 发布于 ${m.publishedAt.slice(0, 10)}` : ""}</span>}
          {s.phase === "uptodate" && <span>{s.checkedAt ? `刚刚检查过 · ${new Date(s.checkedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}` : ""}</span>}
          {s.error && <span className="upd-err">{s.error}</span>}
        </div>

        {m && s.phase !== "uptodate" && m.notes && <div className="upd-notes">{m.notes.split(/\n+/).map((l, i) => <p key={i}>{l}</p>)}</div>}

        <footer className="upd-a">
          {(s.phase === "available") && <button type="button" className="upd-go" onClick={() => void download()}>下载更新</button>}
          {s.phase === "downloading" && <button type="button" className="upd-btn" onClick={() => void pause()}>暂停</button>}
          {s.phase === "paused" && <><button type="button" className="upd-btn" onClick={() => void discard()}>丢弃</button><button type="button" className="upd-go" onClick={() => void download()}>继续</button></>}
          {s.phase === "ready" && <button type="button" className="upd-go" onClick={() => void install()}>安装</button>}
          {s.phase === "error" && <button type="button" className="upd-go" onClick={() => void (m ? download() : check(true))}>重试</button>}
          {(s.phase === "uptodate" || s.phase === "idle") && <button type="button" className="upd-btn" onClick={() => void check(true)}>再检查一次</button>}
        </footer>
      </section>
    </div>
  );
}
