import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { pilotFixture } from "./pilot-fixture.mjs";
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
    ...(process.env.HAIZ_CHROMIUM
      ? { executablePath: process.env.HAIZ_CHROMIUM }
      : existsSync("/usr/bin/chromium")
        ? { executablePath: "/usr/bin/chromium" }
        : {}),
    args: ["--no-sandbox"],
  });
const out = "docs/haiz-operations/evidence/classroom";
mkdirSync(out, { recursive: true });
const checks = [],
  errors = [];
async function page(account, width) {
  const ctx = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width, height: 1000 },
    locale: "zh-CN",
  });
  const p = await ctx.newPage();
  p.setDefaultTimeout(15000);
  await p.clock.install({ time: new Date() });
  p.on("pageerror", (e) => errors.push(e.message));
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
    screen = await page("display-a", 1920),
    other = await page("display-b", 1365),
    student = await page("student-a", 390);
  assert.equal(await teacher.locator("#assignment-form").count(), 1);
  assert.equal(await screen.locator("#assignment-form").count(), 0);
  checks.push(
    "Teacher, student and display enter classroom from Flow with the same secure cookie; read-only identities have no edit controls",
  );
  await teacher.locator("[name=subject]").selectOption("数学");
  await teacher
    .locator("[name=content]")
    .fill("虚构：完成练习一，比较两种解法。");
  await teacher.locator("[name=materials]").fill("练习册");
  await teacher.reload();
  await teacher.locator("[name=content]").waitFor();
  assert.equal(
    await teacher.locator("[name=content]").inputValue(),
    "虚构：完成练习一，比较两种解法。",
  );
  checks.push(
    "HTTPS working draft survives page reload within the same browser session",
  );
  await teacher.locator("#assignment-form").evaluate((f) => f.requestSubmit());
  await teacher.locator("[data-back]").click();
  assert.equal(
    await teacher.locator("[name=materials]").inputValue(),
    "练习册",
  );
  await teacher.locator("#assignment-form").evaluate((f) => f.requestSubmit());
  await teacher.locator("[data-publish]").evaluate((b) => {
    b.click();
    b.click();
  });
  await teacher.locator("dialog").waitFor({ state: "detached" });
  await teacher.locator("#assignment-list .assignment").waitFor();
  assert.equal(
    await teacher.locator("#assignment-list .assignment").count(),
    1,
  );
  await screen.locator("#refresh").click();
  await screen.locator(".assignment").waitFor();
  await student.locator("#refresh").click();
  await student.locator(".assignment").waitFor();
  await other.locator("#refresh").click();
  assert.equal(await other.locator(".assignment").count(), 0);
  checks.push(
    "Real HTTPS publish reaches correct independent display/student contexts and never the other class",
  );
  // Request the teacher status until the actual browser has reported DOM presentation.
  await teacher.waitForFunction(async () => {
    const r = await fetch("/api/classroom/deliveries");
    return (await r.json()).devices.some(
      (d) => d.fresh && d.state === "rendered",
    );
  });
  await teacher.locator("#refresh").click();
  await teacher.waitForFunction(() =>
    document
      .querySelector("#devices")
      ?.textContent.includes("客户端报告已呈现"),
  );
  checks.push(
    "Teacher sees a version-bound receipt only after the display browser reports presentation",
  );
  await screen.screenshot({ path: out + "/display-1920.png", fullPage: true });
  await teacher.screenshot({ path: out + "/teacher-1365.png", fullPage: true });
  await screen.locator("#hide").click();
  assert.equal(await screen.locator(".assignment").count(), 0);
  await teacher.waitForFunction(async () => {
    const r = await fetch("/api/classroom/deliveries");
    return (await r.json()).devices.some(
      (d) =>
        d.fresh && d.state === "suppressed" && d.reason === "manual-hidden",
    );
  });
  await screen.locator("#refresh").click();
  assert.equal(await screen.locator(".assignment").count(), 0);
  checks.push(
    "Manual hide reports suppression and remains in force across synchronization",
  );
  await screen.locator("#hide").click();
  await screen.locator(".assignment").waitFor();
  await teacher.locator("[data-edit]").click();
  await teacher.locator("[name=content]").fill("虚构更正：只完成第一题。");
  await teacher.locator("#assignment-form").evaluate((f) => f.requestSubmit());
  await teacher.locator("[data-publish]").click();
  await teacher.locator("dialog").waitFor({ state: "detached" });
  await screen.locator("#refresh").click();
  await screen
    .locator(".assignment p")
    .filter({ hasText: "虚构更正" })
    .waitFor();
  checks.push(
    "Revision preserves assignment identity and replaces the old display content",
  );
  await screen.context().setOffline(true);
  await screen.locator("#refresh").click();
  assert.ok(
    (await screen.locator("#assignment-list").textContent()).includes(
      "虚构更正",
    ),
  );
  await screen.clock.setFixedTime(new Date("2099-01-01T12:00:00+08:00"));
  await screen.clock.runFor(1500);
  assert.equal(await screen.locator(".assignment").count(), 0);
  checks.push(
    "An open offline display retains the valid public snapshot, then removes it when school date changes",
  );
  await screen.context().setOffline(false);
  teacher.on("dialog", (d) => d.accept());
  await teacher.locator("[data-operation=withdraw]").click();
  await teacher
    .locator("[data-operation=withdraw]")
    .waitFor({ state: "detached" });
  await student.locator("#refresh").click();
  await student.locator(".assignment").waitFor({ state: "detached" });
  assert.equal(await student.locator(".assignment").count(), 0);
  checks.push(
    "Withdrawal reaches the authorized student list; old receipts cannot stand for a new revision",
  );
  await student.route(
    "**/api/classroom/assignments",
    (route) => route.abort(),
    { times: 1 },
  );
  await student.reload();
  await student
    .getByRole("heading", { name: "暂时无法读取班级清单" })
    .waitFor();
  await student.locator("#refresh").click();
  await student.locator("#assignment-list").waitFor();
  checks.push(
    "Initial API failure offers an explicit retry that restores the authenticated list",
  );
  await student.evaluate(() =>
    fetch("/api/flow/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }),
  );
  await student.locator("#refresh").click();
  await student.getByRole("heading", { name: "请重新进入工作台" }).waitFor();
  assert.equal(await student.locator(".assignment").count(), 0);
  checks.push(
    "Revoked or signed-out session cannot retain an active public list after its next sync",
  );
  assert.ok(
    await student.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await student.screenshot({
    path: out + "/student-signed-out-390.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  writeFileSync(
    out + "/results.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        environment:
          "Linux Chromium; TLS loopback fixture with isolated test certificate; independent browser sessions; not school network or native device",
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
