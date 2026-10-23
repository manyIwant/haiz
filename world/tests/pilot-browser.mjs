import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { pilotFixture } from "./pilot-fixture.mjs";
const require = createRequire(import.meta.url);
let pw;
try {
  pw = require("playwright");
} catch {
  pw = require("/opt/codex/cua_node/lib/node_modules/playwright");
}
const engine = process.env.HAIZ_BROWSER || "chromium",
  f = await pilotFixture({ rateLimit: 10000, loginLimit: 100 }),
  browser = await pw[engine].launch({
    headless: true,
    ...(engine === "chromium"
      ? {
          args: ["--no-sandbox", "--ignore-certificate-errors"],
          ...(process.env.HAIZ_CHROMIUM
            ? { executablePath: process.env.HAIZ_CHROMIUM }
            : {}),
        }
      : {}),
  }),
  shots = resolve("docs/haiz-pilot/screenshots/" + engine);
mkdirSync(shots, { recursive: true });
const checks = [],
  errors = [];
let latency;
const shot = (p, name) =>
  p.screenshot({ path: shots + "/" + name + ".png", fullPage: true });
async function page(account, width) {
  const ctx = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width, height: 1000 },
    locale: "zh-CN",
    reducedMotion: "reduce",
  });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(f.origin + "/world/flow/");
  const invite = f.pilot.issueInvite(account);
  await p.locator("#token").fill(invite.invite);
  await p.locator("#fictional").check();
  await p.getByRole("button", { name: "连接试用服务" }).click();
  await p.locator("[data-logout]").waitFor();
  return p;
}
try {
  const mobile = await page("teacher-a", 390),
    desk = await page("teacher-a", 1440),
    screen = await page("display-a", 1920),
    student = await page("student-a", 390),
    other = await page("teacher-b", 1024);
  await desk.locator("[data-importcourses]").click();
  await desk.locator("#importconfirm").click();
  await desk.locator("[data-course-material]").waitFor();
  const materialStart = Date.now();
  await desk.locator("[data-course-material]").click();
  await desk
    .getByRole("heading", { name: "实验课准备", exact: true })
    .last()
    .waitFor();
  const materialMs = Date.now() - materialStart;
  await desk.locator("[data-close]").click();
  const quickStart = Date.now();
  await mobile.locator("#quicknote").fill("演示实验课：准备记录纸");
  await mobile.locator("#quickform button").click();
  await desk.locator("[data-open]").waitFor();
  const quickMs = Date.now() - quickStart;
  checks.push({
    name: "teacher task walkthrough",
    materialClicks: 1,
    materialMs,
    quickActions: "填一句文字 + 一次保存",
    quickMs,
    realTeacher: false,
  });
  await shot(desk, "desk-dashboard");
  await shot(mobile, "mobile-dashboard");
  await desk.locator("[data-open]").first().click();
  await mobile.locator("[data-open]").first().click();
  assert.equal(
    await desk.locator("#title").inputValue(),
    "演示实验课：准备记录纸",
  );
  assert.equal(await other.locator("[data-open]").count(), 0);
  checks.push({
    name: "HTTPS distinct browser contexts share server draft; other teacher isolated",
    physicalDevices: false,
  });
  await desk.locator("#title").fill("桌面改标题");
  await desk.locator("#summary").fill("请携带实验记录纸");
  await desk.locator("#materialNotes").fill("记录纸.pdf · 仅名称说明");
  await desk.locator("[data-save]").click();
  await desk.waitForFunction(() =>
    document.querySelector("#editstatus").textContent.startsWith("已同步"),
  );
  await mobile.locator("#title").fill("手机改标题");
  await mobile.locator("#summary").fill("手机的摘要");
  await mobile.locator("[data-save]").click();
  await mobile.locator('[data-field-choice="title"]').waitFor();
  await shot(mobile, "field-conflict");
  await mobile.locator('[data-field-choice="title"]').selectOption("remote");
  await mobile.locator('[data-field-choice="summary"]').selectOption("manual");
  await mobile
    .locator('[data-field-manual="summary"]')
    .fill("已核对：请带记录纸");
  await mobile
    .locator('[data-field-choice="materialNotes"]')
    .selectOption("remote");
  await mobile.locator('[data-resolve="merge"]').click();
  assert.equal(await mobile.locator("#title").inputValue(), "桌面改标题");
  assert.equal(
    await mobile.locator("#summary").inputValue(),
    "已核对：请带记录纸",
  );
  assert.ok(
    (await mobile.locator("#materialNotes").inputValue()).includes(
      "记录纸.pdf",
    ),
  );
  await mobile.locator("[data-save]").click();
  await mobile.waitForFunction(() =>
    document.querySelector("#editstatus").textContent.startsWith("已同步"),
  );
  checks.push({
    name: "field-specific title, summary and material conflict selection",
  });
  if (engine === "chromium") {
    await mobile.evaluate(() => navigator.serviceWorker.ready);
    await mobile.context().setOffline(true);
    await mobile.locator("#body").fill("离线写下的私人准备");
    await mobile.reload();
    await mobile.locator("#body").waitFor();
    assert.equal(
      await mobile.locator("#body").inputValue(),
      "离线写下的私人准备",
    );
    await mobile.context().setOffline(false);
    await mobile.waitForFunction(() =>
      document.querySelector("#editstatus").textContent.startsWith("已同步"),
    );
    checks.push({
      name: "offline reload uses current-session draft; reconnect syncs",
    });
  } else
    checks.push({
      name: "WebKit offline reload with trusted TLS certificate",
      status: "PENDING_TRUSTED_TLS_ENVIRONMENT",
    });
  const privateLocal = await mobile.evaluate(() =>
    Object.keys(localStorage).filter((k) => k.startsWith("haiz.flow.private.")),
  );
  assert.deepEqual(privateLocal, []);
  const cookies = await mobile.context().cookies();
  assert.ok(
    cookies.find((c) => c.name === "haiz_pilot" && c.httpOnly && c.secure),
  );
  assert.equal(
    await mobile.evaluate(() => document.cookie.includes("haiz_pilot")),
    false,
  );
  checks.push({
    name: "HttpOnly Secure cookie; no private drafts in persistent localStorage",
  });
  await mobile.locator("[data-preview]").click();
  await mobile.locator("#confirm").check();
  const start = Date.now();
  await mobile.locator("#publish").click();
  await screen.getByText("已核对：请带记录纸", { exact: true }).waitFor();
  latency = Date.now() - start;
  assert.ok(!(await screen.locator("body").innerText()).includes("私人准备"));
  await shot(screen, "classroom");
  await mobile.locator("[data-revoke]").click();
  await mobile.locator("#revoke-confirm").click();
  await screen.waitForFunction(
    () => !document.querySelector("#feed").textContent.includes("已核对"),
  );
  checks.push({
    name: "preview → publish → public-only display → revoke",
    latency,
  });
  await student.goto(f.origin + "/world/flow/#clubs");
  await student.locator("[data-club]").first().click();
  await student.locator("#startwork").click();
  await student.locator("#workbody").fill("虚构树影观察");
  await student.locator("[data-worksave]").click();
  await student.reload();
  assert.equal(await student.locator("#workbody").inputValue(), "虚构树影观察");
  checks.push({
    name: "student example project → private work survives reload",
  });
  for (const width of [320, 375, 390, 430, 768, 1024, 1440, 1920]) {
    await desk.setViewportSize({ width, height: 1000 });
    await desk.goto(f.origin + "/world/flow/#desk");
    await desk.locator("#quicknote").waitFor();
    assert.equal(
      await desk.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      "dashboard overflow " + width,
    );
    await shot(desk, "desk-" + width);
  }
  const admin = await f.call("/api/flow/login", {
    body: { invite: f.bootstrap, fictionalOnly: true },
  });
  const state = await f.call("/api/flow/admin", { cookie: admin.cookie });
  const session = state.body.sessions.filter(
    (s) => s.account === "teacher-a",
  )[0];
  await f.call("/api/flow/admin/revoke", {
    cookie: admin.cookie,
    body: { id: session.id },
  });
  await mobile.goto(f.origin + "/world/flow/");
  await mobile.locator("#login").waitFor();
  checks.push({ name: "revoked cookie rejected and private view removed" });
  await other.locator("[data-logout]").click();
  await other.locator("#logout-confirm").click();
  await other.locator("#login").waitFor();
  const status = await other.evaluate(async () => {
    const r = await fetch("/api/flow/me");
    return r.status;
  });
  assert.equal(status, 401);
  checks.push({ name: "logout revokes server session" });
  assert.deepEqual(errors, []);
  writeFileSync(
    resolve("docs/haiz-pilot/browser-" + engine + ".json"),
    JSON.stringify(
      {
        engine,
        platform: process.platform,
        checks,
        errors,
        tls: "local self-signed test certificate; browser ignoreHTTPSErrors, not a public trusted deployment",
        physicalDevices: "NOT_TESTED",
        realTeachers: "NOT_TESTED",
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ engine, checks, errors }, null, 2));
} finally {
  await browser.close();
  await f.close();
}
