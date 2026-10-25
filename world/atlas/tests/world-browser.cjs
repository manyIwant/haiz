"use strict";
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const root = path.resolve(__dirname,"../../..");
const types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json",".jpg":"image/jpeg",".png":"image/png",".webp":"image/webp",".svg":"image/svg+xml",".hdr":"application/octet-stream",".woff2":"font/woff2"};
const server=http.createServer((req,res)=>{
  try {
    const route=new URL(req.url,"http://localhost");
    let file=path.resolve(root,"."+decodeURIComponent(route.pathname));
    if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
    if(fs.statSync(file).isDirectory())file=path.join(file,"index.html");
    res.setHeader("Content-Type",types[path.extname(file)]||"application/octet-stream");
    fs.createReadStream(file).on("error",()=>{if(!res.headersSent)res.writeHead(404).end();}).pipe(res);
  } catch {res.writeHead(404).end();}
});
(async()=>{
  await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
  const url="http://127.0.0.1:"+server.address().port;
  const browser=await chromium.launch({headless:true,args:["--no-sandbox","--enable-unsafe-swiftshader"]});
  const page=await browser.newPage({viewport:{width:1280,height:800},reducedMotion:"reduce"});
  const errors=[];
  page.on("pageerror",err=>errors.push(err.message));
  try{
    page.setDefaultTimeout(160000);
    await page.goto(url+"/world/campus.html?focus=library&observe=1&quality=low",{waitUntil:"domcontentloaded"});
    await page.waitForFunction(()=>window.HaizCampus?.nodes?.length===34&&window.HAIZPlaceConnections?.selected==="library",{timeout:160000});
    assert.match(await page.locator("#intro h1").innerText(),/图书馆/);
    assert.match(await page.locator("#intro .intro-sub").innerText(),/安全位置/);
    assert.ok((await page.locator("#intro .intro-image").getAttribute("src")).includes("campus_library.jpg"));
    const panel=page.locator("#pauseDialog .haiz-place-connection");
    assert.equal(await panel.locator(".haiz-connection-title").innerText(),"图书馆");
    assert.ok((await panel.locator(".haiz-connection-route").getAttribute("href")).endsWith("/world/stillroom/"));
    const ready=await page.evaluate(()=>window.haizWalk.diagnostics());
    assert.equal(ready.nodes,34);
    assert.equal(ready.quality,"low");
    await page.locator("#enterButton").click();
    await page.waitForFunction(()=>document.body.classList.contains("started"),{timeout:30000});
    const state=await page.evaluate(()=>{
      const api=window.haizWalk,b=api.world.buildings.find(b=>b.data.id==="library");
      return {distance:Math.hypot(api.state.pos.x-b.center.x,api.state.pos.z-b.center.z),isStarted:api.state.started,focused:window.HAIZPlaceConnections.selected};
    });
    assert.equal(state.focused,"library");
    assert.equal(state.isStarted,true);
    assert.ok(state.distance<90,"engine must arrive near selected library model, not at north gate: "+state.distance);
    await page.evaluate(()=>window.haizWalk.pause(null));
    await page.locator("#mapButton").evaluate(el=>el.click());
    assert.equal(await page.locator("#mapDialog").getAttribute("open"),"");
    const mapPanel=page.locator("#mapDialog .haiz-place-connection");
    assert.equal(await mapPanel.locator(".haiz-connection-title").innerText(),"图书馆");
    await page.locator('#destinationList [data-destination="yihao"]').evaluate(el=>el.click());
    assert.equal(await page.evaluate(()=>window.HAIZPlaceConnections.selected),"yihao");
    const room=page.locator("#pauseDialog .haiz-connection-route");
    assert.ok((await room.getAttribute("href")).endsWith("/world/room/immersive/"));
    assert.deepEqual(errors,[],"no fatal JavaScript error");
    console.log("PASS actual retained WebGL campus with 34 nodes, low quality and 3D library arrival");
    console.log("PASS map-based navigation updates live education links and preserves real building ids");
    console.log(JSON.stringify({checks:2,device:"Linux Chromium SwiftShader, not physical hardware",state,render:ready,errors}));
  }finally{await page.close();await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;}).finally(()=>server.close());
