/* 纪念页：把“最后一页”画成一张可以保存的图片。
   全部在本机的离屏 Canvas 里完成，不读取任何外部图片（所以 file:// 下也不会被跨域污染），
   不上传任何东西。 */
(function () {
  "use strict";
  var V = window.VegaHomework; if (!V) return;
  var G = V.G, doc = document;
  var $ = function (s) { return doc.querySelector(s); };

  var W = 1080, H = 1500, M = 84, GW = W - M * 2, CELL = GW / 12;
  var HAND = '"Vega Hand","Kaiti SC","STKaiti","KaiTi","楷体",serif';
  var PRINT = '"Vega Print","Songti SC","Noto Serif CJK SC","SimSun","宋体",serif';
  var C = { paper: "#f3eedf", grid: "rgba(64,134,92,.62)", gridStrong: "rgba(48,112,74,.9)", ink: "#1c2742", pencil: "#6a655e", blue: "#173f66", chalk: "#e9f0f3", red: "#cf2a1f" };

  function noiseTile(size, seed, lo, hi) {
    var c = doc.createElement("canvas"); c.width = c.height = size;
    var g = c.getContext("2d"), d = g.createImageData(size, size), r = V.rng(seed);
    for (var i = 0; i < d.data.length; i += 4) { var v = lo + r() * (hi - lo); d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0); return c;
  }

  function paper(ctx) {
    ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalCompositeOperation = "multiply"; ctx.globalAlpha = .5;
    ctx.fillStyle = ctx.createPattern(noiseTile(220, 7, 226, 255), "repeat"); ctx.fillRect(0, 0, W, H);
    ctx.restore();
    var r = V.rng(11); ctx.save(); ctx.lineWidth = 1; ctx.lineCap = "round";
    for (var i = 0; i < 520; i++) {                         // 纸里的纤维
      var x = r() * W, y = r() * H, a = r() * 6.28, l = 6 + r() * 18;
      ctx.strokeStyle = r() > .5 ? "rgba(120,100,60,.07)" : "rgba(255,255,255,.35)";
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a) * l * .5 + (r() - .5) * 6, y + Math.sin(a) * l * .5 + (r() - .5) * 6, x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
    }
    ctx.restore();
    var v = ctx.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, H * .78);
    v.addColorStop(0, "rgba(90,70,30,0)"); v.addColorStop(1, "rgba(90,70,30,.1)");
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(60,50,30,.55)";                    // 撕页线
    for (var px = 9; px < W; px += 18) { ctx.beginPath(); ctx.arc(px, 34, 2.6, 0, 6.2832); ctx.fill(); }
  }

  function handText(ctx, s, x, y, size, color, seed, spacing) {
    var r = V.rng(seed || 3); ctx.fillStyle = color; ctx.textBaseline = "middle"; ctx.textAlign = "left";
    ctx.font = size + "px " + HAND;
    for (var i = 0; i < s.length; i++) {
      var w = ctx.measureText(s[i]).width;
      ctx.save(); ctx.translate(x + w / 2, y + (r() - .5) * size * .05); ctx.rotate((r() - .5) * .05);
      ctx.fillText(s[i], -w / 2, 0); ctx.restore();
      x += w + (spacing || 0);
    }
    return x;
  }

  function header(ctx) {
    ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
    ctx.fillStyle = C.gridStrong; ctx.font = "700 28px " + PRINT;
    ctx.fillText("题", M + 8, 136); ctx.fillText("目", M + 52, 136);
    handText(ctx, G.title || "", M + 116, 118, 50, C.ink, 5, 2);
    ctx.strokeStyle = C.gridStrong; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(M, 156); ctx.lineTo(W - M, 156); ctx.stroke();
  }

  /* 一小张蓝晒的星图，用纸胶带贴在作业纸上 */
  function cyanotype(ctx, x, y, w, h) {
    var r = V.rng(1850), i;
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2); ctx.rotate(-.011); ctx.translate(-w / 2, -h / 2);

    // 刷出来的毛边
    function edge(n, len, amp) { var a = [], lowv = 0; for (var k = 0; k <= n; k++) { lowv += (r() - .5) * amp * .6; lowv *= .82; a.push(lowv + (r() - .5) * amp); } return a; }
    var path = new Path2D(), nT = 64, nS = 34;
    var top = edge(nT, w, 5), bot = edge(nT, w, 5), lef = edge(nS, h, 16), rig = edge(nS, h, 16);
    path.moveTo(lef[0], top[0]);
    for (i = 1; i <= nT; i++) path.lineTo(w * i / nT + (i === nT ? rig[0] : 0), top[i]);
    for (i = 1; i <= nS; i++) path.lineTo(w + rig[i], h * i / nS + (i === nS ? bot[nT] : 0));
    for (i = nT - 1; i >= 0; i--) path.lineTo(w * i / nT + (i === 0 ? lef[nS] : 0), h + bot[i]);
    for (i = nS - 1; i >= 0; i--) path.lineTo(lef[i], h * i / nS + (i === 0 ? top[0] : 0));
    path.closePath();

    var g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, "#1a4670"); g.addColorStop(.55, "#153b62"); g.addColorStop(1, "#113456");
    ctx.save(); ctx.shadowColor = "rgba(40,30,10,.3)"; ctx.shadowBlur = 12; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 5;
    ctx.fillStyle = g; ctx.fill(path); ctx.restore();
    // 两端的干笔拖痕：少、短、有粗有细
    for (i = 0; i < 16; i++) {
      var yy = h * (.06 + r() * .88), left = r() > .5, len = 8 + r() * 24, th = .8 + r() * 2.2;
      ctx.fillStyle = "rgba(21,59,98," + (.25 + r() * .45) + ")";
      ctx.beginPath(); ctx.ellipse(left ? -len * .25 : w + len * .25, yy, len, th, (r() - .5) * .06, 0, 6.2832); ctx.fill();
    }
    ctx.save(); ctx.clip(path);
    for (i = 0; i < 70; i++) {                                // 涂布不匀
      ctx.fillStyle = r() > .5 ? "rgba(8,26,48,.07)" : "rgba(120,170,215,.05)";
      ctx.beginPath(); ctx.ellipse(r() * w, r() * h, 60 + r() * 220, 20 + r() * 60, 0, 0, 6.2832); ctx.fill();
    }
    ctx.globalCompositeOperation = "overlay"; ctx.globalAlpha = .22;
    ctx.fillStyle = ctx.createPattern(noiseTile(180, 23, 70, 190), "repeat"); ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;

    var cx = w * .6, cy = h * .36, scale = w / 22 * 57.2958;
    V.paintSky(ctx, { cx: cx, cy: cy, scale: scale, w: w, h: h, px: 2.25, progress: 1, lyra: true });

    // 手画的圈
    ctx.save(); ctx.translate(cx - 60, cy - 60);
    ctx.strokeStyle = C.chalk; ctx.lineWidth = 4.2; ctx.lineCap = "round";
    ctx.stroke(new Path2D("M88 26 C66 6, 30 12, 17 40 C5 68, 22 101, 54 106 C86 111, 112 86, 108 56 C105 36, 92 24, 76 20"));
    ctx.restore();
    ctx.save(); ctx.translate(cx + 84, cy - 22); ctx.rotate(-.05);
    handText(ctx, G.pointing || "", 0, 0, 52, C.chalk, 9, 1);
    ctx.restore();
    ctx.fillStyle = "rgba(233,240,243,.7)"; ctx.font = "22px " + PRINT; ctx.textBaseline = "middle"; ctx.textAlign = "left";
    ctx.fillText("织女一 · Vega", cx + 90, cy + 40); ctx.fillText("天琴座 α", cx + 90, cy + 74);
    ctx.fillStyle = "rgba(233,240,243,.42)"; ctx.font = "20px " + PRINT; ctx.textAlign = "center";
    ctx.fillText("天 琴 座", cx - .064 * scale, cy + .128 * scale + 14);
    ctx.restore();

    // 纸胶带
    function tape(tx, ty, rot) {
      ctx.save(); ctx.translate(tx, ty); ctx.rotate(rot);
      ctx.fillStyle = "rgba(60,50,30,.14)"; ctx.fillRect(-86, -22, 176, 50);
      ctx.fillStyle = "rgba(233,223,190,.86)"; ctx.fillRect(-88, -25, 176, 50);
      ctx.fillStyle = "rgba(255,255,255,.25)"; ctx.fillRect(-88, -25, 176, 8);
      ctx.restore();
    }
    tape(22, 12, -.62); tape(w - 22, h - 12, -.6);
    ctx.restore();
  }

  function gridRows(ctx, y, rows) {
    var gap = 22, r = V.rng(77);
    rows.forEach(function (row, n) {
      var top = y + n * (CELL + gap);
      ctx.strokeStyle = C.grid; ctx.lineWidth = 1.5;
      ctx.strokeRect(M, top, GW, CELL);
      ctx.beginPath(); for (var k = 1; k < 12; k++) { ctx.moveTo(M + k * CELL, top); ctx.lineTo(M + k * CELL, top + CELL); } ctx.stroke();
      var tks = V.tokens(row.text), col = row.right ? Math.max(0, 12 - tks.length) : (row.indent || 0);
      ctx.fillStyle = C.ink; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      tks.forEach(function (tk) {
        if (col > 11) return;
        ctx.save(); ctx.translate(M + (col + .5) * CELL + (r() - .5) * 3, top + CELL / 2 + (r() - .5) * 3 + 2); ctx.rotate((r() - .5) * .05);
        ctx.font = (tk.lat ? 46 : 54) + "px " + HAND; ctx.fillText(tk.s, 0, 0); ctx.restore(); col++;
      });
    });
    return y + rows.length * (CELL + gap);
  }

  function reviewBox(ctx, y, h) {
    var rv = V.review;
    ctx.strokeStyle = C.gridStrong; ctx.lineWidth = 2.4; ctx.strokeRect(M, y, GW, h);
    ctx.font = "700 28px " + PRINT; ctx.textBaseline = "middle"; ctx.textAlign = "left"; ctx.fillStyle = C.gridStrong;
    var label = "教师批阅", lx = M + 28;
    for (var i = 0; i < label.length; i++) { ctx.fillText(label[i], lx, y + 34); lx += 38; }
    ctx.beginPath(); ctx.moveTo(lx + 8, y); ctx.lineTo(lx + 8, y + 66); ctx.lineTo(M, y + 66); ctx.stroke();

    if (rv.mode === "draw" && rv.strokes.length) {
      var ratio = V.areaRatio() || .71, dw = Math.min(GW, (h - 8) / ratio), ox = M + (GW - dw) / 2;
      V.paintStrokes(ctx, rv.strokes, ox, y + 4, dw);
    } else if (rv.mode === "seal") {
      var cx = W / 2, cy = y + h / 2 + 10, R = Math.min(120, h * .34);
      var s = doc.createElement("canvas"); s.width = s.height = R * 2 + 40; var g = s.getContext("2d");
      g.translate(R + 20, R + 20); g.rotate(-.16);
      g.strokeStyle = C.red; g.lineWidth = R * .075; g.beginPath(); g.arc(0, 0, R, 0, 6.2832); g.stroke();
      g.fillStyle = C.red; g.font = "900 " + (R * 1.18) + "px " + PRINT; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("阅", 0, R * .06);
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "destination-out";       // 印泥不匀
      var r = V.rng(5); for (var k = 0; k < 2600; k++) { g.globalAlpha = r() * .55; g.fillRect(r() * s.width, r() * s.height, 1 + r() * 2.4, 1 + r() * 2.4); }
      ctx.save(); ctx.globalAlpha = .9; ctx.globalCompositeOperation = "multiply"; ctx.drawImage(s, cx - R - 20, cy - R - 20); ctx.restore();
    }
    if (rv.mode && rv.at) {
      ctx.fillStyle = C.red; ctx.font = "24px " + PRINT; ctx.textAlign = "right"; ctx.textBaseline = "alphabetic";
      ctx.fillText("批阅　" + V.fmtDate(rv.at), W - M - 26, y + h - 22);
    }
  }

  function footer(ctx) {
    ctx.fillStyle = "rgba(48,112,74,.82)"; ctx.font = "21px " + PRINT; ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    ctx.fillText("给" + V.teacherTitle + " · 一份没人布置的作业 · 最后一页", W / 2, H - 62);
    ctx.fillStyle = "rgba(48,112,74,.6)"; ctx.font = "18px " + PRINT;
    ctx.fillText("星位据依巴谷星表绘制，并非实时天空 · 没有谁买下或命名这颗星 · 私人礼物", W / 2, H - 30);
  }

  function render() {
    var c = doc.createElement("canvas"); c.width = W; c.height = H;
    var ctx = c.getContext("2d");
    paper(ctx); header(ctx);
    cyanotype(ctx, M - 6, 196, GW + 12, 476);
    var thanks = (G.letterEnd || []).filter(function (s) { return /谢谢/.test(s) && s.length <= 10; })[0] || "谢谢您来过。";
    var rows = [{ text: thanks, indent: 2 }, { text: V.signLine, right: true }];
    if (V.writtenDate()) rows.push({ text: V.writtenDate(), right: true });
    var y = gridRows(ctx, 716, rows);
    reviewBox(ctx, y + 14, H - 100 - (y + 14));
    footer(ctx);
    return c;
  }

  function fontsReady() {
    if (!doc.fonts || !doc.fonts.load) return Promise.resolve();
    var text = (G.title || "") + (G.pointing || "") + V.signLine + V.writtenDate() + (G.letterEnd || []).join("") + "题目教师批阅织女一天琴座给老师一份没人布置的作业最后页星位据依巴谷星表绘制并非实时天空没有谁买下或命名这颗私人礼物年月日0123456789Vegaα·";
    var jobs = [doc.fonts.load('54px "Vega Hand"', text), doc.fonts.load('700 28px "Vega Print"', text), doc.fonts.load('900 60px "Vega Print"', "阅"), doc.fonts.load('22px "Vega Print"', text)];
    var all = Promise.all(jobs.map(function (p) { return p.catch(function () {}); }));
    return Promise.race([all, new Promise(function (res) { setTimeout(res, 3500); })]);
  }

  var dlg = $("#keepsake-dialog"), img = $("#ks-img"), statusEl = $("#ks-status"), actions = $("#ks-actions"), hint = $("#ks-hint");
  var saveBtn = $("#ks-save"), shareBtn = $("#ks-share");
  var current = { blob: null, url: null, name: "" };
  var IN_WECHAT = /MicroMessenger/i.test(navigator.userAgent);
  var HINT = hint.textContent;

  function fail(canvas) {
    statusEl.hidden = false;
    statusEl.textContent = "这台设备没能把这一页存成图片。下面是它的样子，可以直接截屏保存。";
    if (canvas) { canvas.style.cssText = "display:block;width:100%;height:auto"; statusEl.parentNode.insertBefore(canvas, statusEl.nextSibling); current.canvas = canvas; }
  }

  function make() {
    if (current.url) { URL.revokeObjectURL(current.url); current.url = null; }
    if (current.canvas) { current.canvas.remove(); current.canvas = null; }
    img.hidden = true; actions.hidden = true; hint.hidden = true; shareBtn.hidden = true;
    statusEl.hidden = false; statusEl.textContent = "正在把这一页撕下来……";
    current.name = "给" + V.teacherTitle + "-最后一页.png";
    fontsReady().then(function () {
      var canvas;
      try { canvas = render(); } catch (e) { fail(null); statusEl.textContent = "这一页没能生成。可以回到作业本，截屏保存最后一页。"; return; }
      var done = function (blob) {
        if (!blob) { fail(canvas); return; }
        current.blob = blob; current.url = URL.createObjectURL(blob);
        img.onload = function () {
          statusEl.hidden = true; img.hidden = false; hint.hidden = false;
          actions.hidden = false; saveBtn.hidden = IN_WECHAT;
          hint.textContent = IN_WECHAT ? "在微信里，请长按上面的图片，选“保存图片”。图片只在您的手机里生成，不会上传到任何地方。" : HINT;
        };
        img.onerror = function () { fail(canvas); };
        // 预览用 data: 地址——在各家内置浏览器里，长按保存它最可靠；下载和分享用 blob
        try { img.src = canvas.toDataURL("image/png"); } catch (e) { img.src = current.url; }
        try {
          var f = new File([blob], current.name, { type: "image/png" });
          if (navigator.canShare && navigator.canShare({ files: [f] })) { shareBtn.hidden = false; current.file = f; }
        } catch (e) { /* 不支持分享就只留保存 */ }
      };
      try {
        if (canvas.toBlob) canvas.toBlob(done, "image/png");
        else { var u = canvas.toDataURL("image/png"), b = atob(u.split(",")[1]), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); done(new Blob([a], { type: "image/png" })); }
      } catch (e) { fail(canvas); }
    });
  }

  saveBtn.addEventListener("click", function () {
    if (!current.url) return;
    var a = doc.createElement("a"); a.href = current.url; a.download = current.name; a.rel = "noopener";
    doc.body.appendChild(a); a.click(); a.remove();
    hint.textContent = "如果没有开始下载，请长按上面的图片保存。图片只在您的设备里生成，不会上传到任何地方。";
  });
  shareBtn.addEventListener("click", function () {
    if (!current.file) return;
    navigator.share({ files: [current.file] }).catch(function () {});
  });

  function open() { V.openDialog(dlg); make(); }
  $("#keep").addEventListener("click", open);
  $("#keep-blank").addEventListener("click", open);

  window.VegaKeepsake = { render: render, fontsReady: fontsReady };
})();
