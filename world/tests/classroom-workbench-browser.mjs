import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { pilotFixture } from "./pilot-fixture.mjs";
import { schoolDate } from "../homework-core.js";
const require = createRequire(import.meta.url);
let pw;
try {
  pw = require("playwright");
} catch {
  pw = require("/opt/codex/cua_node/lib/node_modules/playwright");
}
const time = Date.parse("2026-10-25T12:00:00+08:00"),
  today = schoolDate(time),
  tomorrow = schoolDate(time + 86400000),
  f = await pilotFixture({
    now: () => time,
    rateLimit: 10000,
    loginLimit: 100,
  });
const browser = await pw.chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
  ...(process.env.HAIZ_CHROMIUM
    ? { executablePath: process.env.HAIZ_CHROMIUM }
    : existsSync("/usr/bin/chromium")
      ? { executablePath: "/usr/bin/chromium" }
      : {}),
});
const out = "docs/haiz-operations/evidence/workbench";
mkdirSync(out, { recursive: true });
const checks = [],
  errors = [];
async function page(account, width) {
  const c = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width, height: 1000 },
      locale: "zh-CN",
    }),
    p = await c.newPage();
  p.setDefaultTimeout(15000);
  p.on("pageerror", (e) => errors.push(e.message));
  await p.clock.install({ time: new Date(time) });
  await p.goto(f.origin + "/world/flow/");
  await p.locator("#token").fill(f.pilot.issueInvite(account).invite);
  await p.locator("#fictional").check();
  await p.locator("#login button").click();
  await p.locator("[data-logout]").waitFor();
  await p.locator('a[href="/world/classroom/"]').first().click();
  await p.locator("#assignment-list").waitFor();
  return p;
}
try {
  const teacher = await page("teacher-a", 1365),
    screen = await page("display-a", 1920);
  await teacher.locator("[name=scope]").selectOption("演示二班");
  await teacher.locator("[name=studyDate]").fill(tomorrow);
  await teacher.locator("[name=content]").fill("虚构：二班明日作业");
  await teacher.locator("#assignment-form").evaluate((f) => f.requestSubmit());
  await teacher.locator("[data-publish]").click();
  await teacher.locator("dialog").waitFor({ state: "detached" });
  await teacher.locator(".assignment").waitFor();
  assert.equal(await teacher.locator("#filter-scope").inputValue(), "演示二班");
  assert.equal(await teacher.locator("#filter-date").inputValue(), tomorrow);
  assert.ok(
    (await teacher.locator("#assignment-list").textContent()).includes(
      "明日作业",
    ),
  );
  checks.push(
    "Publishing tomorrow to another authorized class automatically reveals exactly that date/class",
  );
  await teacher.locator("[name=content]").fill("草稿：筛选不应修改这段文字");
  const draftScope = await teacher.locator("[name=scope]").inputValue(),
    draftDate = await teacher.locator("[name=studyDate]").inputValue();
  await teacher.locator("#filter-today").click();
  assert.equal(await teacher.locator(".assignment").count(), 0);
  assert.equal(
    await teacher.locator("[name=content]").inputValue(),
    "草稿：筛选不应修改这段文字",
  );
  assert.equal(await teacher.locator("[name=scope]").inputValue(), draftScope);
  assert.equal(
    await teacher.locator("[name=studyDate]").inputValue(),
    draftDate,
  );
  checks.push(
    "List filters and Today shortcut never retarget or erase an unfinished assignment draft",
  );
  const cookies = await teacher.context().cookies();
  const cookie = cookies.find((c) => c.name === "haiz_pilot");
  const call = (route, body) =>
    f.call("/api/classroom/" + route, {
      cookie: cookie.name + "=" + cookie.value,
      body,
    });
  const base = {
    scope: "演示一班",
    subject: "数学",
    studyDate: today,
    content: "虚构：今日有效作业",
  };
  await call("assignments", base);
  await call("assignments", {
    ...base,
    content: "虚构：今日待审作业",
    submitForReview: true,
  });
  const removed = await call("assignments", {
    ...base,
    content: "虚构：已撤回的作业",
  });
  await call("assignment-action", {
    id: removed.body.id,
    version: 1,
    operation: "withdraw",
  });
  await teacher.locator("#refresh").click();
  await teacher.waitForFunction(() =>
    document.querySelector("#list-summary")?.textContent.includes("4 项已同步"),
  );
  await teacher.locator("#filter-reset").click();
  assert.equal(await teacher.locator(".assignment").count(), 2);
  await teacher.locator("#filter-status").selectOption("pending");
  assert.equal(await teacher.locator(".assignment").count(), 1);
  assert.ok(
    (await teacher.locator("#assignment-list").textContent()).includes(
      "待审作业",
    ),
  );
  await teacher.locator("#filter-status").selectOption("withdrawn");
  assert.equal(await teacher.locator(".assignment").count(), 1);
  assert.ok(
    (await teacher.locator("#assignment-list").textContent()).includes(
      "已撤回的作业",
    ),
  );
  await teacher.locator("#filter-status").selectOption("all");
  assert.equal(await teacher.locator(".assignment").count(), 3);
  await teacher.locator("#filter-scope").selectOption("演示二班");
  assert.equal(await teacher.locator(".assignment").count(), 0);
  await teacher.locator("#filter-date").fill(tomorrow);
  assert.equal(await teacher.locator(".assignment").count(), 1);
  checks.push(
    "Class/date/review/withdrawn filters and counts distinguish today from future assignments",
  );
  await teacher.locator("#filter-reset").click();
  await screen.locator("#refresh").click();
  await screen.locator(".assignment").waitFor();
  assert.equal(await screen.locator(".assignment").count(), 1);
  checks.push(
    "Teacher filters do not alter the display projection: only its own approved current-day assignment appears",
  );
  await teacher.waitForFunction(async () => {
    const r = await fetch("/api/classroom/deliveries");
    return (await r.json()).devices.some(
      (d) => d.fresh && d.state === "rendered",
    );
  });
  await teacher.locator("#refresh").click();
  await teacher.waitForFunction(
    () => !!document.querySelector('.device[data-fresh="true"]'),
  );
  await teacher.context().setOffline(true);
  await teacher.clock.fastForward(91000);
  await teacher.waitForFunction(
    () => !!document.querySelector('.device[data-fresh="false"]'),
  );
  assert.ok(
    (await teacher.locator("#devices").textContent()).includes(
      "已过期或未确认",
    ),
  );
  checks.push(
    "Teacher going offline cannot retain a permanently fresh presentation receipt; it ages locally without a server reply",
  );
  await teacher.context().setOffline(false);
  await teacher.locator("#refresh").click();
  await teacher.waitForFunction(
    () => !!document.querySelector('.device[data-fresh="true"]'),
  );
  assert.equal(
    await teacher.locator("[name=content]").inputValue(),
    "草稿：筛选不应修改这段文字",
  );
  assert.equal(await teacher.locator("#message").textContent(), "");
  checks.push(
    "Reconnect revalidates receipt freshness, clears the offline warning and preserves the unsaved form",
  );
  await teacher.screenshot({
    path: out + "/teacher-filters-1365.png",
    fullPage: true,
  });
  await teacher.setViewportSize({ width: 390, height: 1000 });
  await teacher.getByRole("link", { name: "筛选与清单", exact: true }).click();
  assert.equal(
    await teacher.locator("[name=content]").inputValue(),
    "草稿：筛选不应修改这段文字",
  );
  assert.ok(
    await teacher.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await teacher.screenshot({
    path: out + "/teacher-filters-390.png",
    fullPage: true,
  });
  checks.push("Teacher filtering and device state fit a 390px viewport");
  await teacher.getByRole("button", { name: "预览作业", exact: true }).click();
  await teacher.locator("[data-review]").click();
  await teacher.locator("dialog").waitFor({ state: "detached" });
  assert.equal(await teacher.locator("#filter-status").inputValue(), "pending");
  await teacher
    .locator(".assignment")
    .filter({ hasText: "草稿：筛选不应修改这段文字" })
    .waitFor();
  await screen.locator("#refresh").click();
  assert.equal(await screen.locator(".assignment").count(), 1);
  checks.push(
    "Submitting for review automatically selects pending items while leaving the approved display projection unchanged",
  );
  await teacher
    .locator("[name=content]")
    .fill("虚构：保存成功后读回失败也不能沿用旧呈现状态");
  await teacher.route("**/api/classroom/deliveries", (r) => r.abort());
  await teacher.getByRole("button", { name: "预览作业", exact: true }).click();
  await teacher.locator("[data-publish]").click();
  await teacher.locator("dialog").waitFor({ state: "detached" });
  await teacher
    .locator(".assignment")
    .filter({ hasText: "保存成功后读回失败" })
    .waitFor();
  assert.equal(await teacher.locator('.device[data-fresh="true"]').count(), 0);
  checks.push(
    "A confirmed write immediately invalidates cached presentation status when its subsequent receipt read fails",
  );
  await teacher.unroute("**/api/classroom/deliveries");
  await screen.locator("#refresh").click();
  await teacher.waitForFunction(async () => {
    const r = await fetch("/api/classroom/deliveries");
    return (await r.json()).devices.some(
      (d) => d.fresh && d.state === "rendered",
    );
  });
  await teacher.locator("#refresh").click();
  await teacher.waitForFunction(
    () => !!document.querySelector('.device[data-fresh="true"]'),
  );
  let releaseOld = null;
  await teacher.route(
    "**/api/classroom/deliveries",
    async (route) => {
      const response = await route.fetch();
      const body = await response.body();
      await new Promise((resolve) => {
        releaseOld = resolve;
      });
      await route.fulfill({ response, body });
    },
    { times: 1 },
  );
  await teacher.locator("#refresh").click();
  const deadline = Date.now() + 5000;
  while (!releaseOld && Date.now() < deadline)
    await new Promise((r) => setTimeout(r, 20));
  assert.ok(
    releaseOld,
    "Old receipt read is held after capturing its server response",
  );
  await teacher
    .locator("[name=content]")
    .fill("虚构：并发读取不能覆盖新发布状态");
  await teacher.getByRole("button", { name: "预览作业", exact: true }).click();
  await teacher.locator("[data-publish]").click();
  await teacher.locator("dialog").waitFor({ state: "detached" });
  releaseOld();
  await teacher
    .locator(".assignment")
    .filter({ hasText: "并发读取不能覆盖新发布状态" })
    .waitFor({ timeout: 3000 });
  assert.equal(await teacher.locator('.device[data-fresh="true"]').count(), 0);
  checks.push(
    "A delayed pre-publication receipt response cannot restore old freshness; the current snapshot is immediately revalidated",
  );
  assert.deepEqual(errors, []);
  writeFileSync(
    out + "/results.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        environment:
          "Linux Chromium with authenticated loopback TLS; browser/server clocks controlled; fictional data; not school device",
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
