"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { chromium } = require("playwright");
const root = path.resolve(__dirname, "../../..");
const output = path.resolve(process.env.HAIZ_ATLAS_ARTIFACTS || path.join(__dirname, "artifacts"));
const contentTypes = { ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".jpg":"image/jpeg", ".png":"image/png", ".webp":"image/webp", ".svg":"image/svg+xml", ".woff2":"font/woff2", ".json":"application/json" };
fs.mkdirSync(output, { recursive:true });
const server = http.createServer((request,response) => {
  try {
    const parsed = new URL(request.url, "http://localhost");
    let local = path.resolve(root, "." + decodeURIComponent(parsed.pathname));
    if (!local.startsWith(root + path.sep) && local !== root) { response.writeHead(403).end(); return; }
    if (fs.statSync(local).isDirectory()) local = path.join(local, "index.html");
    response.setHeader("Content-Type",contentTypes[path.extname(local)] || "application/octet-stream");
    fs.createReadStream(local).on("error", () => response.writeHead(404).end()).pipe(response);
  } catch { response.writeHead(404).end(); }
});
(async () => {
  await new Promise(resolve => server.listen(0,"127.0.0.1",resolve));
  const origin = "http://127.0.0.1:" + server.address().port;
  const browser = await chromium.launch({headless:true,args:["--no-sandbox"]});
  const errors = [], outside = [], checks = [];
  const pass = label => { checks.push(label); console.log("PASS "+label); };
  try {
    const page = await browser.newPage({viewport:{width:1440,height:900},reducedMotion:"no-preference"});
    page.on("pageerror",err=>errors.push(err.message));
    page.on("request",request=>{if(!request.url().startsWith(origin)) outside.push(request.url())});
    await page.goto(origin+"/world/atlas/");
    await page.locator("#sceneVisual").waitFor();
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator(".scene-card").isVisible(), true);
    await page.screenshot({path:path.join(output,"atlas-1440.png"),fullPage:true});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1), true);
    pass("1440px rendering and no horizontal overflow");
    await page.locator("#themeSelect").selectOption("ocean");
    assert.equal(await page.locator("html").getAttribute("data-theme"),"ocean");
    await page.reload();
    assert.equal(await page.locator("html").getAttribute("data-theme"),"ocean");
    pass("three-theme persistence");
    await page.locator("#taskInput").fill("<img src=x onerror=alert(1)>");
    await page.locator("#taskForm button").click();
    assert.equal(await page.locator("#taskList li span").first().innerText(),"<img src=x onerror=alert(1)>");
    assert.equal(await page.locator("#taskList img").count(),0);
    pass("safe local text persistence");
    await page.locator(".dock-item[data-view=study]").click();
    assert.match(await page.locator("#editionTitle").innerText(),/把喧闹留在门外/);
    await page.waitForTimeout(700);
    const offset = await page.evaluate(() => {
      const dock = document.querySelector(".float-dock"),lens=document.querySelector("#dockLens"),active=dock.querySelector(".dock-item.is-active");
      return Math.abs(lens.getBoundingClientRect().left - active.getBoundingClientRect().left);
    });
    assert.ok(offset < 1.5,"spring should settle beneath active icon; difference "+offset);
    pass("finite dock spring convergence");
    await page.locator("#sceneLink").click();
    await page.locator("#scenePortal.is-visible").waitFor();
    assert.match(await page.locator("#portalTitle").innerText(),/世界/);
    await page.screenshot({path:path.join(output,"atlas-handoff-1440.png")});
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#scenePortal").isHidden(),true);
    pass("cinematic handoff can be cancelled with Escape");
    await page.keyboard.press("Control+k");
    assert.equal(await page.locator("#commandDialog").isVisible(),true);
    await page.locator("#commandInput").fill("三维");
    assert.ok(await page.locator("#commandResults a").count()>=1);
    await page.keyboard.press("Escape");
    pass("command search opens from keyboard");
    await page.locator("#sceneLink").click();
    await page.locator("#scenePortal.is-visible").waitFor();
    await Promise.all([page.waitForURL("**/world/stillroom/"),page.locator("#portalSkip").click()]);
    pass("skip button navigates to real STILLROOM route");

    for (const width of [390,320,768]) {
      await page.setViewportSize({width,height:844});
      await page.goto(origin+"/world/atlas/#home");
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1),true,"overflow width="+width);
      if(width===390) await page.screenshot({path:path.join(output,"atlas-390.png"),fullPage:true});
      if(width===320) await page.screenshot({path:path.join(output,"atlas-320.png"),fullPage:true});
    }
    pass("390 / 320 / 768px widths");
    await page.emulateMedia({reducedMotion:"reduce"});
    await page.goto(origin+"/world/atlas/#study");
    assert.equal(await page.locator(".dock-item.is-active").getAttribute("data-view"),"study");
    await Promise.all([page.waitForURL("**/world/stillroom/"),page.locator("#sceneLink").click()]);
    pass("reduced motion skips cinematic delay");
    assert.deepEqual(outside,[],"all resources should remain same-origin");
    assert.deepEqual(errors,[],"no uncaught browser errors");
    pass("no remote requests or uncaught page errors");
    fs.writeFileSync(path.join(output,"browser-results.json"),JSON.stringify({checks,errors,outside,environment:"Linux Playwright Chromium; simulated widths; not physical device"},null,2));
    console.log("TOTAL "+checks.length+" checks passed");
    await page.close();
  } finally {
    await browser.close();
  }
})().catch(error => {console.error(error);process.exitCode=1}).finally(()=>server.close());
