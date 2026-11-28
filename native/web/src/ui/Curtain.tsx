/**
 * 帘 · the curtain sidebar (HAIZ Native 001, after the Whitespace "curtain sidebar" study,
 * reimplemented). Tap the 海 seal on the phone and a curtain of frosted glass falls from the top
 * edge, its pleats swaying as it settles; inside, who you are and everywhere you can go. It is
 * gathered back up on a tap outside, on back, or after you pick a place.
 *
 * All CSS: a clip-path that unrolls, pleats that are one repeating gradient, and a sway that is a
 * keyframed skew. Nothing runs while it is closed.
 */
import { useEffect, useState } from "react";
import { useStore, setState } from "../app/store";
import { go } from "../app/router";
import { pushBack } from "../platform/native";
import "./curtain.css";

const PLACES: [string, string, string][] = [
  ["today", "今日", "课表、待办与通知"], ["schedule", "日程", "这一周的课"], ["focus", "专注", "番茄钟"],
  ["study", "学习", "笔记与实验册"], ["growth", "成长", "专注与阅读的记录"], ["campus/map", "地图", "三维校园，平面与立体"],
  ["rings", "年轮", "校园一年的天气"], ["tree", "榄仁", "百年大叶榄仁的四季"], ["wander", "入画", "走进校园画卷"], ["me", "我", "身份、键盘、更新与设置"],
];

export function Curtain({ onClose }: { onClose(): void }) {
  const who = useStore((s) => s.identity);
  const [closing, setClosing] = useState(false);
  const close = () => { setClosing(true); window.setTimeout(onClose, 380); };
  useEffect(() => pushBack(close), []);
  const to = (r: string, el: Element) => { go(r, el); close(); };
  return (
    <div className={"curt" + (closing ? " is-closing" : "")}>
      <button type="button" className="curt-scrim" aria-label="收起" onClick={close} />
      <nav className="curt-cloth" aria-label="全部去处">
        <div className="curt-pleats" aria-hidden="true" />
        <div className="curt-in">
          <button type="button" className="curt-who" onClick={() => { close(); setState({ wallOpen: true }); }}>
            <b>{who?.name ?? "HAIZ"}</b><span>{[who?.school, who?.cls].filter(Boolean).join(" · ")} · 切换身份</span>
          </button>
          <ul>
            {PLACES.map(([r, t, d], i) => (
              <li key={r} style={{ ["--i" as any]: i }}><button type="button" onClick={(e) => to(r, e.currentTarget)}><b>{t}</b><span>{d}</span></button></li>
            ))}
          </ul>
          <button type="button" className="curt-upd" onClick={() => { close(); setState({ updateOpen: true }); }}>检查更新</button>
        </div>
        <i className="curt-hem" aria-hidden="true" />
      </nav>
    </div>
  );
}
