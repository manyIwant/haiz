/**
 * 收件 · class-group notices, recognised on the phone, confirmed by you (HAIZ Native 002).
 *
 * Each card shows where a message came from (app, group, sender, time), what it said, and what
 * HAIZ read from it (kind, subject, due time, place, why), editable before anything is created.
 * 加入待办 / 加入日程 create it in this identity; 忽略 keeps it out of the way; 删除 forgets it.
 * The settings above the list turn intake on (off by default), pick the apps and the groups, and
 * open Android's notification-access page. Pasting a notice works everywhere, also in a browser.
 */
import { useEffect, useMemo, useState } from "react";
import { useStore, getState } from "../app/store";
import { PageHead } from "../ui/PageHead";
import { Section } from "../ui/Section";
import { Segmented, Switch, Chip } from "../ui/controls";
import { HaizIntake, isNative, type IntakeNativeConfig } from "../platform/native";
import { CATEGORY_LABEL, KIND_LABEL, fmtWhen, type Kind } from "../intake/analyze";
import { LISTEN_SOURCES, SOURCE_LABEL, type InboxItem } from "../intake/types";
import { intakeOne, confirmAsEvent, confirmAsTask, deleteItem, dismissItem, editItem, importEntries, restoreItem, setIntake, view } from "../intake/inbox";
import "./inbox.css";

type Tab = "pending" | "confirmed" | "dismissed";
const KINDS: Kind[] = ["homework", "exam", "event", "deadline", "notice"];
const ago = (t: number) => {
  const d = (Date.now() - t) / 6e4;
  if (d < 1) return "刚刚";
  if (d < 60) return `${Math.floor(d)} 分钟前`;
  if (d < 1440) return `${Math.floor(d / 60)} 小时前`;
  const x = new Date(t);
  return `${x.getMonth() + 1}月${x.getDate()}日`;
};

export function Inbox(_p: { phone: boolean }) {
  const inbox = useStore((s) => s.inbox);
  const pending = useStore((s) => s.inboxPending);
  const [tab, setTab] = useState<Tab>("pending");
  const list = useMemo(() => inbox.filter((i) => i.status === tab), [inbox, tab]);
  const counts = useMemo(() => ({ confirmed: inbox.filter((i) => i.status === "confirmed").length, dismissed: inbox.filter((i) => i.status === "dismissed").length }), [inbox]);
  return (
    <div className="inbox">
      <PageHead kicker="Inbox · 班群通知" title="收件"
        sub={<>从你选定的班群里，只留下和作业、考试、活动、截止有关的消息；识别都在本机完成，确认后才进入待办与日程。</>} />
      <IntakeSettings />
      <Paste />
      <Section kicker="Recognised" title="识别结果"
        action={<Segmented<Tab> value={tab} onChange={setTab} size="sm" label="收件分类"
          options={[{ id: "pending", label: `待确认 ${pending || ""}`.trim() }, { id: "confirmed", label: `已确认 ${counts.confirmed || ""}`.trim() }, { id: "dismissed", label: `已忽略 ${counts.dismissed || ""}`.trim() }]} />}>
        {list.length ? (
          <ul className="ib-list">{list.map((i, n) => <Card key={i.id} item={i} n={n} />)}</ul>
        ) : (
          <p className="ib-empty">{tab === "pending" ? "没有待确认的通知。开启接入并选好班群后，新的作业、考试与截止会出现在这里；也可以先在上面粘贴一条试试。" : tab === "confirmed" ? "确认过的通知会留在这里，并链接到对应的待办或日程。" : "忽略的通知会留在这里，可以恢复或删除。"}</p>
        )}
      </Section>
    </div>
  );
}

/* ---------------------------------------------------------------- one card */
function Card({ item, n }: { item: InboxItem; n: number }) {
  const v = view(item);
  const r = item.result;
  const [open, setOpen] = useState(item.status === "pending" && n < 2);
  const [edit, setEdit] = useState(false);
  const [del, setDel] = useState(false);
  const dueLocal = v.due ? v.due.slice(0, 16) : "";
  return (
    <li className={`ib-card ib-card--${v.kind} is-${item.status}`} style={{ ["--i" as any]: Math.min(n, 8) }}>
      <div className="ib-src">
        <span className={`ib-app ib-app--${item.source}`}>{SOURCE_LABEL[item.source]}</span>
        <span className="ib-grp">{item.group || "—"}{item.sender && <em> · {item.sender}</em>}</span>
        <time>{ago(item.receivedAt)}</time>
      </div>

      <div className="ib-read">
        <span className={`ib-kind ib-kind--${v.kind}`}>{KIND_LABEL[v.kind]}</span>
        <div className="ib-what">
          <b className="ib-title">{v.title}</b>
          <span className="ib-meta">
            <span>{v.subject}</span>
            <span className={"ib-due" + (r.category === "urgent" ? " is-urgent" : "")}>{v.due ? (r.kind === "event" || r.kind === "exam" ? "时间 " : "截止 ") + fmtWhen(v.due, r.allDay) : "时间未识别"}</span>
            {r.where && <span>{r.where}</span>}
          </span>
        </div>
      </div>

      {edit && (
        <div className="ib-edit">
          <label><span>标题</span><input value={v.title} onChange={(e) => editItem(item.id, { title: e.target.value })} /></label>
          <label><span>科目</span><input value={v.subject} onChange={(e) => editItem(item.id, { subject: e.target.value })} /></label>
          <label><span>时间</span><input type="datetime-local" value={dueLocal} onChange={(e) => editItem(item.id, { due: e.target.value || null })} /></label>
          <div className="ib-kinds">{KINDS.map((k) => <Chip key={k} on={v.kind === k} onClick={() => editItem(item.id, { kind: k })}>{KIND_LABEL[k]}</Chip>)}</div>
        </div>
      )}

      <button type="button" className={"ib-raw" + (open ? " is-open" : "")} onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="ib-raw-t">{item.text}</span>
      </button>
      {open && (
        <div className="ib-why">
          <span className="ib-cat">{CATEGORY_LABEL[r.category]} · 置信度{r.confidence === "high" ? "高" : r.confidence === "medium" ? "中" : "低"}{r.ambiguous ? " · 时间需核对" : ""}</span>
          {r.reasons.length > 0 && <span>{r.reasons.join("；")}</span>}
          {item.also?.length ? <span>同一通知也出现在：{item.also.join("、")}</span> : null}
        </div>
      )}

      <div className="ib-acts">
        {item.status === "pending" && <>
          <button type="button" className="ib-act ib-act--pri" onClick={() => confirmAsTask(item.id)}>加入待办</button>
          <button type="button" className="ib-act" onClick={() => confirmAsEvent(item.id)}>加入日程</button>
          <button type="button" className={"ib-act" + (edit ? " is-on" : "")} onClick={() => setEdit(!edit)}>{edit ? "完成" : "修改"}</button>
          <button type="button" className="ib-act ib-act--ghost" onClick={() => dismissItem(item.id)}>忽略</button>
        </>}
        {item.status === "confirmed" && <span className="ib-linked">{item.linked?.taskId ? "已加入待办" : ""}{item.linked?.taskId && item.linked?.eventId ? " · " : ""}{item.linked?.eventId ? "已加入日程" : ""}</span>}
        {item.status === "confirmed" && !item.linked?.eventId && <button type="button" className="ib-act" onClick={() => confirmAsEvent(item.id)}>也加入日程</button>}
        {item.status === "confirmed" && !item.linked?.taskId && <button type="button" className="ib-act" onClick={() => confirmAsTask(item.id)}>也加入待办</button>}
        {item.status === "dismissed" && <button type="button" className="ib-act" onClick={() => restoreItem(item.id)}>恢复</button>}
        <button type="button" className={"ib-act ib-act--del" + (del ? " is-armed" : "")} onClick={() => { if (del) deleteItem(item.id); else { setDel(true); setTimeout(() => setDel(false), 2600); } }}>{del ? "再点一次删除" : "删除"}</button>
      </div>
    </li>
  );
}

/* ---------------------------------------------------------------- settings */
function IntakeSettings() {
  const cfg = useStore((s) => s.intake);
  const [nat, setNat] = useState<IntakeNativeConfig | null>(null);
  const [found, setFound] = useState<{ title: string; source: string; n: number }[]>([]);
  const [add, setAdd] = useState("");
  const native = isNative();
  const refresh = () => { if (native) HaizIntake.getConfig().then(setNat).catch(() => {}); };
  useEffect(() => {
    refresh();
    const f = () => { if (!document.hidden) refresh(); };
    document.addEventListener("visibilitychange", f);
    return () => document.removeEventListener("visibilitychange", f);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // while discovering, look at what turned up every few seconds
  const discovering = !!nat && nat.discoveringUntil > Date.now();
  useEffect(() => {
    if (!discovering) return;
    const t = setInterval(() => { HaizIntake.discovered().then((r) => setFound(r.groups)).catch(() => {}); refresh(); }, 2500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discovering]);

  const apply = async (p: Partial<typeof cfg>) => { const r = await setIntake(p); if (r) setNat(r); };
  const addGroup = (g: string) => {
    const name = g.trim().replace(/\s*[（(]\d+[)）]\s*$/, "");
    if (name.length < 2 || cfg.groups.includes(name)) return;
    void apply({ groups: [...cfg.groups, name] });
    setAdd("");
  };
  const anySource = LISTEN_SOURCES.some((s) => cfg.sources[s]);
  const status = !native ? "浏览器里无法读取手机通知，可以用下面的粘贴来体验识别。"
    : !cfg.enabled ? "接入已关闭。打开后，HAIZ 只处理你选定的班群里与任务有关的通知。"
    : !cfg.groups.length ? "还没有选择班群：没有选定的群，就不会收任何通知。"
    : !anySource ? "还没有打开任何来源应用。"
    : nat && !nat.granted ? "还差一步：在系统设置里允许 HAIZ 使用通知。"
    : "正在接入。新的班群通知到达后会自动识别，等你确认。";

  return (
    <Section kicker="Intake" title="接入设置" className="ib-set">
      <div className="ib-set-row">
        <div><b>接收班群通知</b><small>{status}</small></div>
        <Switch checked={cfg.enabled} disabled={!native} onChange={(v) => apply({ enabled: v, sources: v && !anySource ? { ...cfg.sources, wechat: true } : cfg.sources })} label="接收班群通知" />
      </div>

      {native && cfg.enabled && (
        <>
          <div className="ib-set-row">
            <div><b>通知使用权</b><small>{nat?.granted ? "已允许。随时可以在系统设置里收回。" : "Android 需要你单独允许 HAIZ 读取通知；HAIZ 只保留选定群里与任务有关的内容。"}</small></div>
            <button type="button" className={"ib-pill" + (nat?.granted ? " is-ok" : "")} onClick={() => HaizIntake.openAccessSettings().catch(() => {})}>{nat?.granted ? "已允许" : "去允许"}</button>
          </div>
          <div className="ib-set-block">
            <b>来源应用</b>
            <div className="ib-chips">
              {LISTEN_SOURCES.map((s) => <Chip key={s} on={!!cfg.sources[s]} onClick={() => apply({ sources: { ...cfg.sources, [s]: !cfg.sources[s] } })}>{SOURCE_LABEL[s]}</Chip>)}
            </div>
          </div>
          <div className="ib-set-block">
            <b>选定的班群</b>
            <div className="ib-chips">
              {cfg.groups.map((g) => <span key={g} className="ib-grp-chip">{g}<button type="button" aria-label={`移除 ${g}`} onClick={() => apply({ groups: cfg.groups.filter((x) => x !== g) })}>×</button></span>)}
              {!cfg.groups.length && <small className="ib-hint">输入群名（与通知里显示的群名一致或包含其中的字），或用「查找我的群」从新通知里挑选。</small>}
            </div>
            <div className="ib-add">
              <input value={add} placeholder="群名，例如 高二（3）班家校群" onChange={(e) => setAdd(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addGroup(add); }} />
              <button type="button" className="ib-pill" onClick={() => addGroup(add)} disabled={add.trim().length < 2}>添加</button>
              <button type="button" className={"ib-pill" + (discovering ? " is-on" : "")} onClick={async () => {
                if (discovering) { await HaizIntake.stopDiscovery(); setFound([]); refresh(); }
                else { const r = await HaizIntake.startDiscovery(); setNat(r); }
              }}>{discovering ? "停止查找" : "查找我的群"}</button>
            </div>
            {discovering && (
              <div className="ib-found">
                <small>未来 10 分钟里，像群聊的新通知会把群名列在这里（只记群名，不记内容）。点一下加入。</small>
                <div className="ib-chips">
                  {found.filter((f) => !cfg.groups.includes(f.title)).map((f) => <Chip key={f.title} onClick={() => addGroup(f.title)}>{f.title}<em className="ib-n">{SOURCE_LABEL[f.source as keyof typeof SOURCE_LABEL] ?? ""}</em></Chip>)}
                  {!found.length && <small className="ib-hint">等待新通知…</small>}
                </div>
              </div>
            )}
          </div>
        </>
      )}
      <p className="ib-privacy">只在本机处理：不读取微信等应用的数据库或聊天记录，不需要账号密码，不上传任何内容；只看到之后 Android 推送的新通知。消息属于当前身份，保存在本机的身份数据库里。</p>
    </Section>
  );
}

/* ---------------------------------------------------------------- paste */
function Paste() {
  const [t, setT] = useState("");
  const [msg, setMsg] = useState("");
  const go = () => {
    const text = t.trim();
    if (!text) return;
    const r = intakeOne({ source: "paste", group: "手动粘贴", text, at: Date.now() }, getState().inbox);
    const n = r.skipped ? 0 : importEntries([{ source: "paste", group: "手动粘贴", text, at: Date.now() }]);
    setMsg(n ? "已识别，见下方待确认。" : r.skipped ? "这条看起来和作业、考试、活动或截止无关，没有保留。" : "这条和已有的通知重复了。");
    setT("");
  };
  return (
    <div className="ib-paste" data-rv>
      <textarea value={t} rows={2} placeholder="粘贴一条班群通知，例如：请大家周五 18:00 前在学习通提交物理实验报告" onChange={(e) => { setT(e.target.value); setMsg(""); }} />
      <div className="ib-paste-r">
        <small>{msg || "也可以在别的应用里选中文字，分享给 HAIZ。"}</small>
        <button type="button" className="ib-pill ib-pill--pri" onClick={go} disabled={!t.trim()}>识别</button>
      </div>
    </div>
  );
}
