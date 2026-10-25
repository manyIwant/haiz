import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { pilotFixture } from "./pilot-fixture.mjs";
import { schoolDate } from "../homework-core.js";
const require = createRequire(import.meta.url);
let pw;
try {
  pw = require("playwright");
} catch {
  pw = require("/opt/codex/cua_node/lib/node_modules/playwright");
}
const f = await pilotFixture({ rateLimit: 10000, loginLimit: 100 }),
  browser = await pw.chromium.launch({
    headless: true,
    args: ["--no-sandbox"],
    ...(process.env.HAIZ_CHROMIUM
      ? { executablePath: process.env.HAIZ_CHROMIUM }
      : existsSync("/usr/bin/chromium")
        ? { executablePath: "/usr/bin/chromium" }
        : {}),
  });
const out = "docs/haiz-operations/evidence/conflicts";
mkdirSync(out, { recursive: true });
const checks = [],
  errors = [];
async function page() {
  const c = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 1365, height: 1000 },
      locale: "zh-CN",
      acceptDownloads: true,
    }),
    p = await c.newPage();
  p.setDefaultTimeout(15000);
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(f.origin + "/world/flow/");
  await p.locator("#token").fill(f.pilot.issueInvite("teacher-a").invite);
  await p.locator("#fictional").check();
  await p.locator("#login button").click();
  await p.locator("[data-logout]").waitFor();
  await p.locator('a[href="/world/classroom/"]').first().click();
  await p.locator("#assignment-form").waitFor();
  return p;
}
const read = async (p) =>
  p.evaluate(async () => {
    const r = await fetch("/api/classroom/assignments");
    return (await r.json()).assignments;
  });
const post = async (p, path, body) =>
  p.evaluate(
    async ({ path, body }) => {
      const r = await fetch("/api/classroom/" + path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
          "X-Haiz-Actor": "teacher-a",
        },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw Error(await r.text());
      return r.json();
    },
    { path, body },
  );
const preview = async (p) =>
  p.getByRole("button", { name: "预览作业", exact: true }).click();
try {
  const a = await page(),
    b = await page();
  const initial = {
    scope: "演示一班",
    subject: "数学",
    studyDate: schoolDate(),
    content: "初始要求",
    materials: "课本",
    due: "课后",
  };
  await post(a, "assignments", initial);
  await a.locator("#refresh").click();
  await a.locator("[data-edit]").waitFor();
  await b.locator("#refresh").click();
  await b.locator("[data-edit]").waitFor();
  await a.locator("[data-edit]").click();
  await a.locator("[name=content]").fill("甲设备：自己的解法要求");
  await a.locator("[name=materials]").fill("本机直尺");
  await preview(a);
  await b.locator("[data-edit]").click();
  await b.locator("[name=content]").fill("乙设备：<b>另一种要求</b>");
  await b.locator("[name=due]").fill("明早交");
  await preview(b);
  await b.locator("[data-publish]").click();
  await b.locator("dialog").waitFor({ state: "detached" });
  await a.locator("[data-publish]").click();
  await a.locator("[data-draft-conflict]").waitFor();
  assert.ok(
    (await a.locator("[data-draft-conflict]").textContent()).includes(
      "乙设备：<b>另一种要求</b>",
    ),
  );
  assert.equal(await a.locator("[data-draft-conflict] b").count(), 0);
  await a.screenshot({ path: out + "/conflict-1365.png", fullPage: true });
  await a.setViewportSize({ width: 390, height: 1000 });
  assert.ok(
    await a.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  await a.screenshot({ path: out + "/conflict-390.png", fullPage: true });
  await a.setViewportSize({ width: 1365, height: 1000 });
  checks.push(
    "Two authenticated devices editing the same version receive a real conflict dialog with safely rendered server/local text",
  );
  await a.locator("#resolve-draft button[type=submit]").click();
  assert.equal(await a.locator("[data-draft-conflict]").count(), 1);
  assert.equal((await read(a))[0].version, 2);
  checks.push(
    "A conflicting field requires an explicit selection and resolving never publishes automatically",
  );
  await a.locator("[name=merge-content][value=local]").check();
  await a.locator("#resolve-draft button[type=submit]").click();
  await a.locator("dialog").waitFor({ state: "detached" });
  assert.equal(
    await a.locator("[name=content]").inputValue(),
    "甲设备：自己的解法要求",
  );
  assert.equal(await a.locator("[name=materials]").inputValue(), "本机直尺");
  assert.equal(await a.locator("[name=due]").inputValue(), "明早交");
  assert.equal((await read(a))[0].version, 2);
  checks.push(
    "Independent changes are preserved and explicit conflict selection returns to editing against the latest version",
  );
  await preview(a);
  await a.locator("[data-publish]").click();
  await a.locator("dialog").waitFor({ state: "detached" });
  let row = (await read(a))[0];
  assert.equal(row.version, 3);
  assert.equal(row.materials, "本机直尺");
  assert.equal(row.due, "明早交");
  checks.push(
    "The merged draft still requires preview and a real version-checked publish",
  );
  // A later administrator/second device change must not erase an unsent restored draft.
  await a.locator("[data-edit]").click();
  await a.locator("[name=content]").fill("刷新后应恢复的旧版草稿");
  await post(b, "assignments", { ...row, content: "服务器新的要求" });
  await a.reload();
  await a.locator("[name=content]").waitFor();
  assert.equal(
    await a.locator("[name=content]").inputValue(),
    "刷新后应恢复的旧版草稿",
  );
  await a.locator("#compare-draft").waitFor({ state: "visible" });
  await a.locator("#compare-draft").click();
  await a.locator("[data-draft-conflict]").waitFor();
  await a.locator("[name=merge-content][value=local]").check();
  await a.locator("#resolve-draft button[type=submit]").click();
  await a.locator("dialog").waitFor({ state: "detached" });
  checks.push(
    "Reload restores outdated draft text and offers comparison instead of leaving it inaccessible or replacing it",
  );
  row = (await read(a))[0];
  await post(b, "assignment-action", {
    id: row.id,
    version: row.version,
    operation: "withdraw",
  });
  await a.locator("#refresh").click();
  await a.locator(".assignment").waitFor({ state: "detached" });
  await preview(a);
  await a.locator("[data-draft-conflict]").waitFor();
  assert.ok(
    (await a.locator(".conflict-warning").textContent()).includes("撤回"),
  );
  await a.locator("#resolve-draft button[type=submit]").click();
  await a.locator("dialog").waitFor({ state: "detached" });
  await preview(a);
  await a.getByRole("button", { name: "确认重新发布", exact: true }).waitFor();
  assert.equal((await read(a))[0].status, "withdrawn");
  await a.locator("[data-back]").click();
  checks.push(
    "A concurrent withdrawal is highlighted and cannot be silently reversed by merging",
  );
  await a.setViewportSize({ width: 390, height: 1000 });
  await a.locator("#compare-draft").count();
  await a.locator("#export-draft").waitFor();
  const download = a.waitForEvent("download");
  await a.locator("#export-draft").click();
  const file = await download;
  const text = readFileSync(await file.path(), "utf8");
  assert.ok(text.includes("刷新后应恢复的旧版草稿"));
  assert.equal(text.includes("haiz_pilot"), false);
  assert.ok(
    await a.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  );
  checks.push(
    "Current draft can be downloaded as text without session credentials on a 390px layout",
  );
  await a.screenshot({ path: out + "/restored-draft-390.png", fullPage: true });
  await a.evaluate(() =>
    fetch("/api/flow/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }),
  );
  await a.locator("#refresh").click();
  await a.getByRole("button", { name: "导出本机未发布草稿" }).waitFor();
  const expiredDownload = a.waitForEvent("download");
  await a.getByRole("button", { name: "导出本机未发布草稿" }).click();
  assert.ok(
    readFileSync(await (await expiredDownload).path(), "utf8").includes(
      "刷新后应恢复的旧版草稿",
    ),
  );
  assert.equal(await a.locator(".assignment").count(), 0);
  checks.push(
    "Expired or revoked session removes the public view while preserving an explicit local draft export",
  );
  await a.screenshot({
    path: out + "/expired-session-recovery-390.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  writeFileSync(
    out + "/results.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        environment:
          "Linux Chromium; independent authenticated loopback TLS sessions; fictional public assignments; not school hardware",
        checks,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ checks, errors }));
} finally {
  await browser.close();
  await f.close();
}
