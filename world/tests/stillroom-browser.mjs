import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { pilotFixture } from "./pilot-fixture.mjs";
const require = createRequire(import.meta.url);
let pw;
try {
  pw = require("playwright");
} catch {
  pw = require("/opt/codex/cua_node/lib/node_modules/playwright");
}
const f = await pilotFixture(),
  b = await pw.chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--ignore-certificate-errors"],
    ...(process.env.HAIZ_CHROMIUM
      ? { executablePath: process.env.HAIZ_CHROMIUM }
      : {}),
  });
const errors = [],
  external = [],
  checks = [];
mkdirSync("docs/haiz-pilot/screenshots/stillroom", { recursive: true });
try {
  const c = await b.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
    }),
    p = await c.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("request", (r) => {
    if (!r.url().startsWith(f.origin) && !r.url().startsWith("blob:"))
      external.push(r.url());
  });
  await p.goto(f.origin + "/world/stillroom/");
  await p.locator("#introMask.done").waitFor({state:"attached"});
  await p.screenshot({
    path: "docs/haiz-pilot/screenshots/stillroom/desktop.png",
  });
  await p.locator('[data-minutes="15"]').click();
  assert.equal(await p.locator("#timerText").innerText(), "15:00");
  await p.locator("#timerStart").click();
  await p.waitForTimeout(1200);
  await p.reload();
  await p.locator("#introMask.done").waitFor({state:"attached"});
  assert.equal(await p.locator("#startButtonText").innerText(), "继续专注");
  checks.push("timer reload pauses without fabricating attended time");
  await p.locator('[data-room-target="morning"]').click();
  assert.equal(await p.locator("body").getAttribute("data-room"), "morning");
  await p.locator("#openJournal").click();
  await p.locator("#journalInput").fill("虚构练习：下一步检查第二种解法");
  await p.locator("#saveNote").click();
  await p.locator(".saved-note").waitFor();
  await p.reload();
  await p.locator("#introMask.done").waitFor({state:"attached"});
  await p.locator("#openJournal").click();
  await p.locator(".saved-note").waitFor();
  assert.ok((await p.locator("#savedNotes").textContent()).includes("第二种解法"));
  await p.locator("#closeSheet").click();
  checks.push("room switch and private session note recovery");
  await p.evaluate(() => caches.open("other-app-test"));
  await p.reload();
  assert.ok((await p.evaluate(() => caches.keys())).includes("other-app-test"));
  checks.push("own service worker does not delete sibling application caches");
  await p.evaluate(() => navigator.serviceWorker.ready);
  await c.setOffline(true);
  await p.reload();
  await p.locator("#introMask.done").waitFor({state:"attached"});
  checks.push("local art and controls load offline");
  await c.setOffline(false);
  for (const width of [320, 375, 390, 430, 768, 1024, 1440, 1920]) {
    await p.setViewportSize({ width, height: 900 });
    assert.equal(
      await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
      `overflow ${width}`,
    );
    if ([390, 768].includes(width))
      await p.screenshot({
        path: `docs/haiz-pilot/screenshots/stillroom/${width}.png`,
      });
  }
  assert.deepEqual(external, []);
  assert.deepEqual(errors, []);
  writeFileSync(
    "docs/haiz-pilot/stillroom-results.json",
    JSON.stringify(
      {
        checks,
        external,
        errors,
        device: "Linux Chromium; not physical phone",
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ checks, external, errors }));
} finally {
  await b.close();
  await f.close();
}
