// Deterministic local text rules. No model, network call, or publishing authority.
export function suggestActions(body) {
  return String(body || "")
    .split(/[。！？\n]+/)
    .map((text) => text.trim())
    .filter(Boolean)
    .slice(0, 50)
    .filter((text) => /请|需要|记得|准备|提交|带|完成|检查|确认/.test(text))
    .slice(0, 6)
    .map((text) => ({
      text: text.slice(0, 280),
      kind: /提交|完成|检查|准备/.test(text) ? "候选待办" : "候选提醒",
      dateHint:
        (text.match(
          /(?:今天|明天|后天|周[一二三四五六日天]|\d{1,2}月\d{1,2}日)/,
        ) || [])[0] || "未识别日期",
    }));
}
