import test from "node:test";
import assert from "node:assert/strict";
import { compareDraft, draftText } from "../classroom/draft-merge.js";
test("three-way draft reconciliation preserves independent changes and requires a choice for colliding text", () => {
  const base = {
    scope: "一班",
    subject: "数学",
    studyDate: "2026-10-25",
    content: "原要求",
    materials: "课本",
    due: "课后",
  };
  const rows = compareDraft(
    base,
    { ...base, content: "本机要求", materials: "本机直尺" },
    { ...base, content: "服务器要求", due: "明早" },
  );
  assert.equal(rows.find((r) => r.key === "content").conflict, true);
  assert.equal(rows.find((r) => r.key === "materials").conflict, false);
  assert.equal(rows.find((r) => r.key === "materials").value, "本机直尺");
  assert.equal(rows.find((r) => r.key === "due").value, "明早");
  assert.equal(rows.find((r) => r.key === "scope").value, "一班");
});
test("legacy drafts with no comparison base fail conservatively and exports contain only assignment fields", () => {
  const rows = compareDraft(
    null,
    { content: "本机" },
    { content: "服务器", materials: "书" },
  );
  assert.equal(rows.find((r) => r.key === "content").conflict, true);
  assert.equal(rows.find((r) => r.key === "materials").conflict, true);
  assert.equal(
    compareDraft(
      { content: "old" },
      { materials: "" },
      { materials: "new" },
    ).find((r) => r.key === "materials").conflict,
    true,
  );
  const text = draftText({
    content: "<b>原文字</b>",
    token: "private-secret",
    actor: "account",
    sessionId: "session",
    body: "私人通知正文",
  });
  assert.ok(text.includes("<b>原文字</b>"));
  for (const hidden of ["private-secret", "account", "session", "私人通知正文"])
    assert.equal(text.includes(hidden), false);
});
