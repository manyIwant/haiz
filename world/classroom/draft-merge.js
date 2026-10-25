// Only public assignment fields are compared; credentials and account state never enter exports.
export const DRAFT_FIELDS = [
  ["scope", "班级"],
  ["subject", "学科"],
  ["studyDate", "展示日期"],
  ["content", "作业要求"],
  ["materials", "需要准备"],
  ["due", "交付说明"],
];
export function draftFields(input) {
  return Object.fromEntries(
    DRAFT_FIELDS.map(([key]) => [
      key,
      typeof input?.[key] === "string" ? input[key] : "",
    ]),
  );
}
export function compareDraft(base, local, remote) {
  const hasBase =
    !!base && DRAFT_FIELDS.every(([key]) => typeof base[key] === "string");
  const a = draftFields(base),
    b = draftFields(local),
    c = draftFields(remote);
  return DRAFT_FIELDS.map(([key, label]) => {
    const conflict =
      b[key] !== c[key] &&
      (!hasBase || (b[key] !== a[key] && c[key] !== a[key]));
    const value =
      b[key] === c[key]
        ? b[key]
        : hasBase && b[key] === a[key]
          ? c[key]
          : b[key];
    return {
      key,
      label,
      base: a[key],
      local: b[key],
      remote: c[key],
      conflict,
      value,
    };
  });
}
export function draftText(input) {
  const fields = draftFields(input);
  return (
    "HAIZ 作业草稿 · 未发布内容，请勿公开分享\n" +
    DRAFT_FIELDS.map(([key, label]) => label + "：" + fields[key]).join("\n") +
    "\n"
  );
}
