/**
 * 我 · who you are this semester, and how the product should behave for you. The settings are
 * real: 动态强度 drives the one global clock (0 lands everything instantly), the theme writes
 * the token set, and the teacher switch changes the accent and the rail.
 */
import { useStore, setState, type Theme } from "../app/store";
import { go } from "../app/router";
import { STUDENT, TEACHER, GROWTH } from "../data/demo";
import { teachingWeek } from "../app/time";
import { PageHead } from "../ui/PageHead";
import { Section } from "../ui/Section";
import { Demo, Segmented, Slider, Switch, Icon } from "../ui/controls";
import { ThemeToggle } from "../ui/ThemeToggle";
import { IdentityPanel } from "../identity/IdentityPanel";
import { HaizNative, isNative } from "../platform/native";
import { useEffect, useState } from "react";
import { HaizUpdater } from "../platform/native";
import "./pages.css";

const WEEKS = 20;
const level = (v: number) => (v < 0.04 ? "静止" : v < 0.45 ? "克制" : v < 0.9 ? "柔和" : "完整");

export function Me({ phone }: { phone: boolean }) {
  const theme = useStore((s) => s.theme);
  const intensity = useStore((s) => s.intensity);
  const notify = useStore((s) => s.notify);
  const role = useStore((s) => s.role);
  const compact = useStore((s) => s.railCompact);
  const tasks = useStore((s) => s.tasks);
  const keyboard = useStore((s) => s.keyboard);
  const perf = useStore((s) => s.perfPanel);
  const [ver, setVer] = useState<string>(__APP_VERSION__);
  useEffect(() => { if (isNative()) HaizUpdater.installed().then((v) => setVer(`${v.versionName}（${v.versionCode}）`)).catch(() => {}); }, []);
  const wk = Math.min(WEEKS, teachingWeek());
  const teacher = role === "teacher";
  return (
    <div className="me">
      <PageHead kicker={teacher ? `Me · ${TEACHER.subject}` : `Me · ${STUDENT.cls}`} title={teacher ? TEACHER.name : STUDENT.name}
        sub={<>{teacher ? TEACHER.classes.join("、") : (STUDENT.no ? `学号 ${STUDENT.no}` : STUDENT.cls || "学生")} · 本学期第 <b className="t-num">{wk}</b> 周</>} />

      <div className="me-top" data-rv>
        <SemesterArc week={wk} />
        <div className="me-nums">
          <button type="button" className="me-num" onClick={(e) => go("growth", e.currentTarget)}>
            <span className="t-num">{GROWTH.streak}</span><small>连续专注天数</small>
          </button>
          <button type="button" className="me-num" onClick={(e) => go("today", e.currentTarget)}>
            <span className="t-num">{tasks.filter((t) => !t.done).length}</span><small>未完成待办</small>
          </button>
          <button type="button" className="me-num" onClick={(e) => go("growth", e.currentTarget)}>
            <span className="t-num">{GROWTH.focus.reduce((a, b) => a + b, 0)}</span><small>本周专注 · 分钟</small>
          </button>
        </div>
      </div>

      <Section kicker="Identities" title="校园身份">
        <IdentityPanel />
      </Section>

      <Section kicker="Settings" title="设置">
        <div className="set">
          <Row t="明暗" d="拨动玻璃开关，新的光从开关处铺满页面。">
            <ThemeToggle />
          </Row>
          <Row t="跟随系统" d="打开后，随系统的深浅色一起切换。">
            <Switch checked={theme === "system"} onChange={(v) => setState({ theme: v ? "system" : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") as Theme })} label="跟随系统" />
          </Row>
          <Row t="键盘" d={<>HAIZ 键盘：拼音（RIME 引擎）、英文、数字与符号、语音。也可以随时换回手机自己的输入法{isNative() ? "，长按键盘上的「中/英」可打开系统输入法列表" : ""}。</>}>
            <Segmented<"haiz" | "system"> value={keyboard} onChange={(v) => setState({ keyboard: v })} size="sm" label="键盘"
              options={[{ id: "haiz", label: "HAIZ 键盘" }, { id: "system", label: "系统输入法" }]} />
          </Row>
          <Row t="动态强度" d={<>所有动效共用一个时钟。调到 0，界面立即落定，等同系统的「减少动态效果」。当前：<b>{level(intensity)}</b></>} wide>
            <div className="set-slider"><Slider value={intensity} min={0} max={1} step={0.01} onChange={(v) => setState({ intensity: Math.round(v * 100) / 100 })} format={(v) => level(v)} label="动态强度" /></div>
          </Row>
          <Row t="通知提醒" d="新通知到达时，顶栏的铃会轻轻摆动一次。">
            <Switch checked={notify} onChange={(v) => setState({ notify: v })} label="通知提醒" />
          </Row>
          {!phone && (
            <Row t="紧凑侧栏" d="侧栏只留图标；悬停时，标签从图标里长出来。">
              <Switch checked={compact} onChange={(v) => setState({ railCompact: v })} label="紧凑侧栏" />
            </Row>
          )}
          <Row t="班群通知接入" d="收件：从选定的班群里识别作业、考试、活动与截止，确认后进入待办与日程。默认关闭，只在本机处理。">
            <button type="button" className="set-btn" onClick={(e) => go("inbox", e.currentTarget)}>打开收件</button>
          </Row>
          <Row t="版本与更新" d={<>当前 {ver}。新版本从 GitHub Releases 下载，校验签名与 SHA-256 后覆盖安装，身份与数据全部保留。</>}>
            <button type="button" className="set-btn" onClick={() => setState({ updateOpen: true })}>检查更新</button>
          </Row>
          <Row t="性能面板" d="开发者用：帧率、帧时、长任务、掉帧、内存与温控；可导出报告与模拟测试对照。">
            <Switch checked={perf} onChange={(v) => setState({ perfPanel: v })} label="性能面板" />
          </Row>
          {isNative() && <Row t="输入法列表" d="打开系统的输入法选择器。">
            <button type="button" className="set-btn" onClick={() => void HaizNative.pickInputMethod()}>选择</button>
          </Row>}
          <Row t="教师身份" d="切换后出现教师工作台，强调色由琉璃绿换成陶土色。">
            <Switch checked={teacher} onChange={(v) => { setState({ role: v ? "teacher" : "student" }); if (v) go("teacher"); }} label="教师身份" />
          </Row>
        </div>
      </Section>

      <Section kicker="About" title="关于这个原型">
        <ul className="about">
          <li>
            <a className="about-row" href="https://haiz.space/" target="_blank" rel="noopener">
              <Icon kind="campus" size={20} /><span><b>HAIZ 主站</b><small>校园模型、年轮、入画与实验册的完整版本。</small></span><i>↗</i>
            </a>
          </li>
        </ul>
        <div className="credits">
          <p><b>真实的部分</b>校园建筑平面与说明（HAIZ 校园模型，依据海南中学官网资料与实测平面）；校园照片（海南中学官网与 HAIZ 项目实拍，逐张注明）；年轮的逐日天气（ERA5 再分析，经 Open-Meteo，CC BY 4.0）；入画的渲染与绘画（HAIZ painted-lab）。</p>
          <p><b>演示的部分</b>学生与教师身份、课表、待办、通知正文、社团活动、笔记、成长数据。界面中凡是这类内容，都带有 <Demo /> 标记。</p>
          <p className="ink-3">HAIZ Native · 基于 Experiment 006 · 非官方作品，与海南中学无隶属关系。拼音引擎 librime（BSD-3）/ jsh_rime（Apache-2.0）。</p>
        </div>
      </Section>
    </div>
  );
}

function Row({ t, d, children, wide }: { t: string; d: React.ReactNode; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={"set-row" + (wide ? " set-row--wide" : "")}>
      <div className="set-l"><b>{t}</b><span>{d}</span></div>
      <div className="set-c">{children}</div>
    </div>
  );
}

/** the semester as a datum: twenty weeks on an arc, the one lit mark is this week */
function SemesterArc({ week }: { week: number }) {
  const R = 92, cx = 110, cy = 112, a0 = Math.PI * 0.8, a1 = Math.PI * 2.2;
  const at = (i: number, r = R) => {
    const a = a0 + ((a1 - a0) * i) / (WEEKS - 1);
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };
  const arc = (from: number, to: number) => {
    const [x0, y0] = at(from), [x1, y1] = at(to);
    const large = ((a1 - a0) * (to - from)) / (WEEKS - 1) > Math.PI ? 1 : 0;
    return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${R} ${R} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
  };
  const [lx, ly] = at(week - 1);
  return (
    <figure className="sem">
      <svg viewBox="0 0 220 200" aria-label={`本学期第 ${week} 周，共 ${WEEKS} 周`}>
        <path d={arc(0, WEEKS - 1)} className="hl-sub" />
        {week > 1 && <path d={arc(0, week - 1)} className="hl-pri" />}
        {Array.from({ length: WEEKS }, (_, i) => {
          const [x0, y0] = at(i, R - 5), [x1, y1] = at(i, R + 5);
          const mid = i === 9;
          return <path key={i} d={`M${x0.toFixed(2)} ${y0.toFixed(2)}L${x1.toFixed(2)} ${y1.toFixed(2)}`} className={i < week ? "hl-sec" : "hl-sub"} strokeWidth={mid ? 1.6 : undefined} />;
        })}
        <circle cx={lx} cy={ly} r={4.2} className="hl-lit" />
        <circle cx={lx} cy={ly} r={9} className="sem-halo" />
      </svg>
      <figcaption>
        <span className="t-num sem-n">{week}<small>/{WEEKS}</small></span>
        <span className="sem-l">教学周 · 期中在第 10 周</span>
      </figcaption>
    </figure>
  );
}
