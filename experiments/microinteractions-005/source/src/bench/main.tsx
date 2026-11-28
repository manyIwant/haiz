/**
 * 新旧对照验收台 · the acceptance bench.
 *
 *  一  Dock: Experiment 004 (its own page, untouched, in a frame) beside the 005 dock, under ONE
 *      time control (1× / 0.35× / 0.12× / pause / +1 frame) and the same four scripted gestures.
 *      004 is driven through its own test handle (window.__HAIZ_LAB4__), 005 through the global
 *      clock (window.__haizClock) and DockEngine.pointerAt — so both run the same choreography.
 *  二  Pages: the OJO prototype (reference) beside the 005 page, same phone frame.
 *  三  Components: every base control, live.
 *  四  Performance: frame intervals, active loops, and an idle test that proves the clock sleeps.
 */
import { createRoot } from "react-dom/client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import "../styles/fonts.generated.css";
import "../styles/tokens.css";
import "../styles/base.css";
import "../styles/icons.css";
import "../ui/controls.css";
import "../app/shell.css";
import "../pages/pages.css";
import "./bench.css";
import { clock, type Telemetry } from "../kernel/motion";
import { Dock } from "../ui/dock/Dock";
import type { DockEngine, DockItem } from "../ui/dock/engine";
import { Button, Switch, Slider, Segmented, Field, Select, Check, Chip, WeekPicker, Icon, Demo } from "../ui/controls";
import type { IconKind } from "../icons/kinetic";
import { useStore, setState, applyTheme, applyMotionVars, type Theme } from "../app/store";

/* the five items of Experiment 004, so both docks carry the same content */
const ITEMS: DockItem[] = [
  { id: "campus", icon: "campus", label: "建筑", stage: { w: 300, h: 140 } },
  { id: "canopy", icon: "tree", label: "榄仁", stage: { w: 300, h: 140 } },
  { id: "instrument", icon: "lab", label: "实验", stage: { w: 300, h: 140 } },
  { id: "folio", icon: "notes", label: "共创", stage: { w: 300, h: 140 } },
  { id: "lens", icon: "lens", label: "探索", stage: { w: 300, h: 140 } },
];
const STAGE: Record<string, { k: string; t: string; m: string; a: string[] }> = {
  campus: { k: "01 · 1923", t: "府城建筑", m: "一号楼 · 北门 · 图书馆", a: ["一号教学楼", "全园总平"] },
  canopy: { k: "02 · 物候", t: "百年榄仁", m: "板根骨架 · 四季叶冠", a: ["深秋红叶", "盛夏浓荫"] },
  instrument: { k: "03 · 50Hz", t: "力学实验", m: "打点计时 · 瞬时测速", a: ["释放打点", "匀加速"] },
  folio: { k: "04 · 档案", t: "双叶志", m: "摄影显影 · 短诗接力", a: ["翻阅样刊", "新建接力"] },
  lens: { k: "05 · ⌘K", t: "全景检索", m: "线稿检验 · 跨区直达", a: ["校园索引", "快捷命令"] },
};

type Lab4 = { clock: { setScale(s: number): void; setPaused(p: boolean): void; stepFrame(ms?: number): void; getState(): { fps: number; scale: number; paused: boolean } }; runScript(k: string): void };
const SPEEDS = [{ id: "1", label: "1×" }, { id: "0.35", label: "0.35×" }, { id: "0.12", label: "0.12×" }];
const SCRIPTS = [
  { id: "sweep", label: "平滑顺扫" },
  { id: "jump", label: "跨距跳跃" },
  { id: "reverse", label: "高速折返打断" },
  { id: "press", label: "悬停 → 停留 → 进入" },
];

/* ---------- scripted choreography on the 005 clock (so pause and +1 frame freeze it too) ---------- */
let stopScript: (() => void) | null = null;
function play(events: [number, () => void][]) {
  stopScript?.();
  let t = 0, i = 0;
  const off = clock.add((dt) => {
    t += dt * 1000;
    while (i < events.length && events[i][0] <= t) events[i++][1]();
    if (i >= events.length) { off(); stopScript = null; return false; }
    return true;
  });
  stopScript = off;
}
function centers(e: DockEngine) {
  const o = e.root.getBoundingClientRect();
  const bays = [...e.root.querySelectorAll<HTMLElement>(".dock-bay")];
  const xs = bays.map((b) => { const r = b.getBoundingClientRect(); return r.left + r.width / 2 - o.left; });
  const r0 = bays[0].getBoundingClientRect();
  return { xs, y: r0.top + r0.height / 2 - o.top };
}
/** build the events for one dock; `glide` interpolates a pointer path in 16ms steps */
function choreo(kind: string, e: DockEngine, enter: (id: string) => void): [number, () => void][] {
  const { xs, y } = centers(e);
  const ev: [number, () => void][] = [];
  const glide = (t0: number, x0: number, x1: number, dur: number) => {
    const n = Math.max(1, Math.round(dur / 16));
    const vx = (x1 - x0) / dur;
    for (let k = 0; k <= n; k++) {
      const x = x0 + ((x1 - x0) * k) / n;
      ev.push([t0 + (dur * k) / n, () => e.pointerAt(x, y, vx)]);
    }
    return t0 + dur;
  };
  const at = (t: number, f: () => void) => ev.push([t, f]);
  if (kind === "sweep") {
    const t = glide(0, xs[0] - 30, xs[4] + 30, 1300);
    at(t + 260, () => e.pointerAt(null));
  } else if (kind === "jump") {
    [[0, 1.0], [4, 2.5], [1, -2.2], [3, 1.9]].forEach(([i, vx], k) => at(k * 360, () => e.pointerAt(xs[i], y, vx)));
    at(4 * 360, () => e.pointerAt(null));
  } else if (kind === "reverse") {
    [[0, 2.2], [1, 2.4], [2, 2.5], [3, 2.5], [2, -2.6], [1, -2.6], [3, 2.6], [0, -2.5], [2, 1.8]].forEach(([i, vx], k) => at(k * 95, () => e.pointerAt(xs[i], y, vx)));
    at(9 * 95, () => e.pointerAt(null));
  } else if (kind === "press") {
    let t = glide(0, xs[0], xs[2], 380);
    t += 900; // hold: 280ms of stillness opens the stage (停), then it is read
    at(t, () => enter(ITEMS[2].id)); // 入
    at(t + 700, () => e.pointerAt(null));
  }
  ev.sort((a, b) => a[0] - b[0]);
  return ev;
}

function Bench() {
  const theme = useStore((s) => s.theme);
  const [speed, setSpeed] = useState("1");
  const [paused, setPaused] = useState(false);
  const [active, setActive] = useState({ desk: "campus", phone: "campus" });
  const frame = useRef<HTMLIFrameElement>(null);
  const desk = useRef<DockEngine | null>(null);
  const phone = useRef<DockEngine | null>(null);
  const [log, setLog] = useState("等待编排。");
  const lab4 = () => (frame.current?.contentWindow as any)?.__HAIZ_LAB4__ as Lab4 | undefined;

  useEffect(() => { applyTheme(); applyMotionVars(); }, []);
  // keep 004's theme in step with ours
  useEffect(() => {
    const dark = document.documentElement.getAttribute("data-theme") === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    try { (frame.current?.contentWindow as any)?.__HAIZ_LAB4__?.applyTheme(dark ? "dark" : "light"); } catch { /* not loaded yet */ }
  }, [theme]);

  // drive 004 through its own buttons where it has them, so its toolbar shows the same state
  const doc4 = () => { try { return frame.current?.contentDocument ?? null; } catch { return null; } };
  const doSpeed = (v: string) => {
    setSpeed(v); setPaused(false);
    clock.setScale(+v); applyMotionVars();
    const b = doc4()?.querySelector<HTMLButtonElement>(`[data-speed="${v}"]`);
    if (b) b.click(); else lab4()?.clock.setScale(+v);
  };
  const doPause = () => {
    const p = !paused; setPaused(p);
    clock.setPaused(p);
    const l = lab4();
    if (l && l.clock.getState().paused !== p) { const b = doc4()?.querySelector<HTMLButtonElement>("#btn-pause"); if (b) b.click(); else l.clock.setPaused(p); }
  };
  const doStep = () => {
    setPaused(true); clock.step(16.667);
    const b = doc4()?.querySelector<HTMLButtonElement>("#btn-step");
    if (b) b.click(); else lab4()?.clock.stepFrame(16.67);
  };
  const run = (k: string) => {
    setPaused(false); clock.setPaused(false); lab4()?.clock.setPaused(false);
    lab4()?.runScript(k);
    const evs: [number, () => void][] = [];
    if (desk.current) evs.push(...choreo(k, desk.current, (id) => setActive((a) => ({ ...a, desk: id }))));
    if (phone.current) evs.push(...choreo(k, phone.current, (id) => setActive((a) => ({ ...a, phone: id }))));
    evs.sort((a, b) => a[0] - b[0]);
    play(evs);
    setLog(`${SCRIPTS.find((s) => s.id === k)?.label} · 004 与 005 同时开始${+speed < 1 ? ` · ${speed}× 慢放` : ""}`);
  };

  return (
    <div className="bench">
      <header className="bh">
        <div className="bh-l">
          <a className="bh-mark" href="./">海</a>
          <div><b>HAIZ 005 · 新旧对照验收台</b><span>非官方演示原型 · 004 原样嵌入，005 为本次实验</span></div>
        </div>
        <div className="bh-r">
          <Segmented<Theme> value={theme} onChange={(v) => setState({ theme: v })} size="sm" label="主题" options={[{ id: "system", label: "跟随" }, { id: "light", label: "浅" }, { id: "dark", label: "深" }]} />
          <a className="btn btn--sec btn--sm" href="./"><span className="btn-l">返回原型</span></a>
        </div>
      </header>

      <nav className="bctl" aria-label="时间与编排">
        <div className="bctl-g">
          <span className="bctl-k">时间</span>
          <Segmented value={paused ? "" : speed} onChange={doSpeed} size="sm" label="播放速度" options={SPEEDS} />
          <Button kind={paused ? "pri" : "sec"} size="sm" onClick={doPause}>{paused ? "继续" : "暂停"}</Button>
          <Button kind="line" size="sm" onClick={doStep}>+1 帧</Button>
        </div>
        <div className="bctl-g">
          <span className="bctl-k">编排</span>
          {SCRIPTS.map((s) => <Button key={s.id} kind="ghost" size="sm" onClick={() => run(s.id)}>{s.label}</Button>)}
        </div>
        <TeleBar lab4={lab4} />
      </nav>

      <main className="bm">
        <Part n="一" title="Dock：三种语言，提炼成一种" lead={<>上方是 Experiment 004 的原页面（含 003 基线与 A 弹性让位、B 液态膜、C 折痕舞台），下方是 005 的统一 Dock。两边由同一组时间控制与编排驱动，慢放到 0.12× 可以逐帧比较。<span className="ink-3">{log}</span></>}>
          <div className="b-frame b-frame--004">
            <div className="b-cap"><b>Experiment 004 · 原样</b><span>004 自带的四栏对照；其内部按钮仍可单独使用</span></div>
            <iframe ref={frame} src="ref/lab004/index.html" title="Experiment 004 对照台" loading="eager" />
          </div>
          <div className="b-005">
            <div className="b-dockpane">
              <div className="b-cap"><b>005 · 桌面</b><span>掠：相邻让位（1 → .31 → .09）· 停：280ms 后从同一轮廓长出舞台 · 入：点下即进入</span></div>
              <div className="b-dockbox b-dockbox--desk">
                <Dock inline config={{ items: ITEMS, active: active.desk, satellite: null, size: "desk", searchOpen: false, searchStage: { w: 560, h: 260 } }}
                  onEnter={(id) => setActive((a) => ({ ...a, desk: id }))} engineRef={(e) => { desk.current = e; }} renderStage={(id, close) => <StageBody id={id} close={close} />} />
              </div>
            </div>
            <div className="b-dockpane b-dockpane--phone">
              <div className="b-cap"><b>005 · 手机</b><span>拖动扫过、长按 380ms 留住舞台</span></div>
              <div className="b-dockbox b-dockbox--phone">
                <Dock inline config={{ items: ITEMS.slice(0, 4), active: active.phone, satellite: { id: "lens", icon: "lens", label: "探索" }, size: "phone", searchOpen: false, searchStage: { w: 360, h: 260 } }}
                  onEnter={(id) => setActive((a) => ({ ...a, phone: id }))} engineRef={(e) => { phone.current = e; }} renderStage={(id, close) => <StageBody id={id} close={close} />} />
              </div>
            </div>
          </div>
          <ul className="b-laws">
            <li><b>让位</b><span>004-A 的弹性让位保留为“掠”：焦点变宽，邻居按距离衰减让出宽度，总宽守恒，不是 macOS 式放大。</span></li>
            <li><b>同源</b><span>004-B 的液态膜收敛为一条轮廓：舞台、搜索、结果都从胶囊的同一条边界长出，内部没有接缝。</span></li>
            <li><b>生长</b><span>004-C 的折痕只留下一条点线，标出舞台与胶囊的交界；内容按距离依次显现。</span></li>
            <li><b>基准</b><span>底部一条细线随焦点弯曲并承载唯一的亮点：当前所在。</span></li>
          </ul>
        </Part>

        <PagesPart />

        <Part n="三" title="基础组件" lead="同一套行为：连续变化用弹簧，离散变化用 700ms 的 (.32, .72, 0, 1)，按压有形变，动态强度为 0 时立即落定。">
          <Gallery />
        </Part>

        <Part n="四" title="性能与休眠" lead="所有动效共用一个时钟：没有东西在动时，时钟不再申请动画帧。下面的检测会在 3 秒内不碰任何东西，数一数时钟走了几帧。">
          <Perf />
        </Part>
      </main>
    </div>
  );
}

/** telemetry hook: only the component that shows numbers re-renders on a tick */
function useTele() {
  const [t, setT] = useState<Telemetry | null>(null);
  useEffect(() => clock.onTelemetry(setT), []);
  return t;
}
function TeleBar({ lab4 }: { lab4: () => Lab4 | undefined }) {
  const tele = useTele();
  const [fps4, setFps4] = useState<number | null>(null);
  useEffect(() => {
    const id = setInterval(() => { const s = lab4()?.clock.getState(); if (s) setFps4(s.fps); }, 500);
    return () => clearInterval(id);
  }, [lab4]);
  return (
    <div className="bctl-tele t-num" aria-live="off">
      <span><i className={tele && tele.active > 0 ? "on" : ""} />005 {tele?.fps ?? 60} fps</span>
      <span>工作 {tele?.frameMs.toFixed(2) ?? "0.00"} ms</span>
      <span>活动回路 {tele?.active ?? 0}</span>
      <span>004 {fps4 ?? "—"} fps</span>
    </div>
  );
}

function StageBody({ id, close }: { id: string; close: () => void }) {
  const s = STAGE[id];
  if (!s) return null;
  return (
    <div className="stg">
      <div className="stg-k" style={{ ["--i" as any]: 0 }}>{s.k}</div>
      <div className="stg-t" style={{ ["--i" as any]: 1 }}>{s.t}</div>
      <div className="stg-m" style={{ ["--i" as any]: 2 }}>{s.m}</div>
      <div className="stg-acts" style={{ ["--i" as any]: 3 }}>
        <button type="button" className="stg-act" data-stage-action onClick={close}>{s.a[0]}</button>
        <button type="button" className="stg-act stg-act--pri" data-stage-action onClick={close}>{s.a[1]}</button>
      </div>
    </div>
  );
}

function Part({ n, title, lead, children }: { n: string; title: string; lead: ReactNode; children: ReactNode }) {
  return (
    <section className="bp">
      <header className="bp-h"><span className="bp-n">{n}</span><div><h2 className="t-title">{title}</h2><p>{lead}</p></div></header>
      {children}
    </section>
  );
}

/* ---------- 二 · pages ---------- */
const PAGES = [
  { id: "today", ojo: "today", label: "今日", note: "OJO 的信息架构保留：课程、待办、通知。005 把“下一节”做成唯一的深色块，时间轴上有一条“现在”线；待办完成时行会让位滑动，而不是闪烁重排。" },
  { id: "study", ojo: "study", label: "学习", note: "笔记卡片之外加入了可交互的实验册（单摆、磁铁与线圈、凸透镜），用 Hairline 线稿语法绘制；学习接力保留。" },
  { id: "schedule", ojo: "schedule", label: "日程", note: "桌面周视图的五列会让位：指针所在的那一天展开成议程，其余四天压缩成科目，总宽不变。手机端用周选择器 + 议程。" },
  { id: "focus", ojo: "focus", label: "专注", note: "计时器是一张会长年轮的横截面：每 5 分钟一圈。开始后侧栏和顶栏退后，底部 Dock 变成计时器自己的控制。" },
  { id: "campus/map", ojo: "campus", label: "校园", note: "地图来自 HAIZ 校园模型的 34 个真实平面，用等距线稿绘制；悬停按距离抬升，点击打开建筑详情（照片与说明来自学校官网和项目实拍）。" },
  { id: "growth", ojo: "growth_record", label: "成长", note: "只和上周的自己比较；今天的柱子是唯一的亮色。数据为演示。" },
  { id: "rings", ojo: "annals", label: "年轮", note: "OJO 的“年鉴”改为 HAIZ 年轮：1923 年以来每年一圈，环宽来自当年雨量，每格一天，数据为 ERA5 再分析。" },
  { id: "tree", ojo: "tree", label: "榄仁", note: "一株大叶榄仁的一年：塔形分层的枝条，叶片随月份转色、落下又萌发。物候为概括，标注“约”。" },
  { id: "wander", ojo: "wander", label: "入画", note: "同一机位的渲染与绘画，用一片会折光的玻璃来切换，不做假混合。" },
  { id: "me", ojo: "me", label: "我", note: "设置是真的：动态强度驱动全局时钟，0 即“减少动态效果”；主题、教师身份即时生效。" },
  { id: "teacher", ojo: "teacher_workspace", label: "教师", note: "陶土色身份。右侧是学生端预览，打字时草稿行在学生列表里生长；发布后真的进入学生的今日与公告。" },
];
function PagesPart() {
  const [p, setP] = useState(PAGES[0].id);
  const page = PAGES.find((x) => x.id === p)!;
  return (
    <Part n="二" title="页面：OJO 原型 → 005" lead="左边是 OJO 原型（只作产品参考），右边是 005 的同一页面，同一尺寸的手机框。OJO 页面依赖外部图标库，加载可能稍慢。">
      <div className="bpg-tabs"><Segmented value={p} onChange={setP} size="sm" label="页面" options={PAGES.map((x) => ({ id: x.id, label: x.label }))} /></div>
      <div className="bpg">
        <figure className="bpg-f"><div className="bpg-phone"><iframe src={`ref/ojo/${page.ojo}.html`} title={`OJO · ${page.label}`} loading="lazy" /></div><figcaption>OJO 原型 · {page.label}</figcaption></figure>
        <figure className="bpg-f"><div className="bpg-phone"><iframe key={p} src={`./#/${p}`} title={`005 · ${page.label}`} loading="lazy" /></div><figcaption>005 · {page.label}</figcaption></figure>
        <p className="bpg-note">{page.note}</p>
      </div>
    </Part>
  );
}

/* ---------- 三 · gallery ---------- */
const ICONS: IconKind[] = ["today", "study", "campus", "me", "lens", "schedule", "focus", "lab", "rings", "tree", "wander", "bell", "notes", "notice", "club", "map", "teacher", "plus", "settings", "theme", "growth", "relay", "playpause", "stop", "close", "culture"];
function Gallery() {
  const [sw, setSw] = useState(true);
  const [sl, setSl] = useState(0.42);
  const [seg, setSeg] = useState("b");
  const [txt, setTxt] = useState("");
  const [sel, setSel] = useState("c3");
  const [chk, setChk] = useState(false);
  const [chip, setChip] = useState("全部");
  const [wk, setWk] = useState(2);
  const [on, setOn] = useState<string>("today");
  const intensity = useStore((s) => s.intensity);
  return (
    <div className="bg">
      <Card t="按钮 Button" d="主按钮是深琉璃色；按压时整体下沉 1px。">
        <div className="bg-row"><Button kind="pri" icon="focus">开始专注</Button><Button kind="sec" icon="plus">新建</Button><Button kind="line">次要</Button><Button kind="ghost">文字</Button><Button kind="sec" icon="settings" title="设置" /></div>
      </Card>
      <Card t="开关 Switch" d="旋钮在移动中按速度拉长，按住时变宽：液态的同一种材料。">
        <div className="bg-row"><Switch checked={sw} onChange={setSw} label="开关" /><span className="t-meta">{sw ? "开" : "关"}</span></div>
      </Card>
      <Card t="滑块 Slider" d="基准线在拇指下方下沉；读数从拇指里长出来。">
        <Slider value={sl} onChange={setSl} format={(v) => `${Math.round(v * 100)}%`} label="示例滑块" />
      </Card>
      <Card t="分段 Segmented" d="一块共享的底板在选项间滑行，速度越快越扁。">
        <Segmented value={seg} onChange={setSeg} label="示例分段" options={[{ id: "a", label: "公告" }, { id: "b", label: "社团" }, { id: "c", label: "地图" }, { id: "d", label: "文化" }]} />
      </Card>
      <Card t="输入 Field" d="亮线从按下的位置向两侧长出。">
        <Field label="标题" value={txt} onChange={setTxt} placeholder="点在任意位置试试" />
      </Card>
      <Card t="选择器 Select" d="菜单从按钮的轮廓里长出（Grow），不是另起一个弹窗。">
        <Select value={sel} onChange={setSel} label="班级" options={[{ id: "c3", label: "高二（3）班", meta: "45 人" }, { id: "c5", label: "高二（5）班", meta: "44 人" }, { id: "all", label: "两个班", meta: "89 人" }]} />
      </Card>
      <Card t="勾选 Check 与筛选 Chip" d="勾的笔画被画出来，而不是出现。">
        <div className="bg-row"><Check checked={chk} onChange={() => setChk(!chk)} label="示例勾选" /><span className="t-meta">{chk ? "已完成" : "未完成"}</span></div>
        <div className="chips" style={{ marginTop: 12 }}>{["全部", "语文", "数学", "物理"].map((c) => <Chip key={c} on={chip === c} onClick={() => setChip(c)}>{c}</Chip>)}</div>
      </Card>
      <Card t="周选择 WeekPicker" d="分段控件的一种：日期是底板的内容。">
        <WeekPicker value={wk} onChange={setWk} labels={["周一", "周二", "周三", "周四", "周五"].map((w, i) => ({ top: w, bottom: String(23 + i), mark: i === 1 }))} />
      </Card>
      <Card t="动态强度" d="与「我 · 设置」是同一个值：拖到 0，本页所有动效立即落定。" wide>
        <Slider value={intensity} onChange={(v) => setState({ intensity: Math.round(v * 100) / 100 })} format={(v) => (v < 0.04 ? "静止" : `${Math.round(v * 100)}%`)} label="动态强度" />
      </Card>
      <Card t="动态图标" d="26 个图标都是带物理的线稿：悬停时先变化（掠），按下时形变，选中时点亮唯一的亮点。点一下切换选中。" wide>
        <div className="bg-icons">
          {ICONS.map((k) => (
            <button key={k} type="button" className={"bg-ico" + (on === k ? " is-on" : "")} onClick={() => setOn(k)} aria-label={k}>
              <Icon kind={k} size={26} active={on === k} /><small>{k}</small>
            </button>
          ))}
        </div>
        <p className="foot-note"><Demo>图标名为代码名</Demo></p>
      </Card>
    </div>
  );
}
function Card({ t, d, children, wide }: { t: string; d: string; children: ReactNode; wide?: boolean }) {
  return <div className={"bg-card" + (wide ? " bg-card--wide" : "")}><b>{t}</b><p>{d}</p><div className="bg-live">{children}</div></div>;
}

/* ---------- 四 · performance ---------- */
function Perf() {
  const cv = useRef<HTMLCanvasElement>(null);
  const stopSampling = useRef<() => void>(() => {});
  const hist = useRef<number[]>([]);
  const [idle, setIdle] = useState<{ state: "idle" | "run" | "done"; frames?: number; raf?: number }>({ state: "idle" });
  // frame intervals, measured independently of the clock with our own short rAF window while visible
  useEffect(() => {
    let raf = 0, last = performance.now(), alive = true;
    const loop = (t: number) => {
      if (!alive) return;
      hist.current.push(t - last); last = t;
      if (hist.current.length > 180) hist.current.shift();
      draw();
      raf = requestAnimationFrame(loop);
    };
    const draw = () => {
      const c = cv.current; if (!c) return;
      const dpr = Math.min(2, devicePixelRatio || 1), W = c.clientWidth, H = c.clientHeight;
      if (c.width !== W * dpr) { c.width = W * dpr; c.height = H * dpr; }
      const g = c.getContext("2d")!; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      const css = getComputedStyle(document.documentElement);
      g.strokeStyle = css.getPropertyValue("--line-2"); g.lineWidth = 1;
      for (const ms of [16.7, 33.3]) { const y = H - (ms / 50) * H; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      g.fillStyle = css.getPropertyValue("--ink-3");
      const h = hist.current, bw = W / 180;
      h.forEach((ms, i) => { const bh = Math.min(H, (ms / 50) * H); g.fillStyle = ms > 20 ? css.getPropertyValue("--lanren") : css.getPropertyValue("--ink-4"); g.fillRect(i * bw, H - bh, Math.max(1, bw - 0.5), bh); });
    };
    // only sample while the chart is on screen, so the bench itself can go idle for the test
    const io = new IntersectionObserver(([e]) => { cancelAnimationFrame(raf); if (e.isIntersecting && idleRef.current !== "run") { last = performance.now(); raf = requestAnimationFrame(loop); } });
    stopSampling.current = () => cancelAnimationFrame(raf);
    if (cv.current) io.observe(cv.current);
    return () => { alive = false; cancelAnimationFrame(raf); io.disconnect(); };
  }, []);
  const idleRef = useRef<string>("idle");
  const test = () => {
    setIdle({ state: "run" }); idleRef.current = "run";
    stopSampling.current(); // the chart's own sampler would count as a frame request
    // give the button's own press a moment to settle, then watch for three seconds
    setTimeout(() => {
      const f0 = clock.frame;
      const orig = window.requestAnimationFrame;
      let n = 0;
      window.requestAnimationFrame = ((cb: FrameRequestCallback) => { n++; return orig(cb); }) as any;
      setTimeout(() => {
        window.requestAnimationFrame = orig;
        idleRef.current = "done";
        setIdle({ state: "done", frames: clock.frame - f0, raf: n });
      }, 3000);
    }, 600);
  };
  return (
    <div className="bpf">
      <div className="bpf-chart">
        <div className="b-cap"><b>帧间隔</b><span>最近 180 帧 · 细线为 16.7 / 33.3 ms · 超过 20ms 标红</span></div>
        <canvas ref={cv} />
        <PerfNums hist={hist} />
      </div>
      <div className="bpf-idle">
        <div className="b-cap"><b>空闲休眠检测</b><span>开始后请不要移动指针</span></div>
        <Button kind="pri" onClick={test} disabled={idle.state === "run"}>{idle.state === "run" ? "检测中… 3 秒" : "开始检测"}</Button>
        {idle.state === "done" && (
          <p className={"bpf-res" + (idle.frames === 0 ? " is-ok" : "")}>
            {idle.frames === 0 ? "时钟走了 0 帧：没有东西在动时，它已经睡着。" : `时钟走了 ${idle.frames} 帧：还有动画在运行（若刚刚移动过指针，请重试）。`}
            <small>本页在 3 秒内共申请 {idle.raf} 次动画帧（含 004 之外的一切；004 在自己的框里另算）。</small>
          </p>
        )}
      </div>
    </div>
  );
}

function PerfNums({ hist }: { hist: React.MutableRefObject<number[]> }) {
  const tele = useTele();
  const a = [...hist.current].sort((x, y) => x - y);
  const p95 = a.length ? a[Math.floor(a.length * 0.95)] : 0;
  return <div className="bpf-nums t-num"><span>p95 {p95.toFixed(1)} ms</span><span>时钟 {tele?.fps ?? 60} fps</span><span>最差 {tele?.worstMs ?? 0} ms</span><span>每帧工作 {tele?.frameMs.toFixed(2) ?? "0.00"} ms</span></div>;
}

createRoot(document.getElementById("root")!).render(<Bench />);
