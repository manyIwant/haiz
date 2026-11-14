/* 《没人布置的作业》主程序。
   不依赖任何库；经典脚本（非 module），所以直接双击 index.html 也能打开。 */
(function () {
  "use strict";

  var G = window.GIFT || {};
  var SKY = window.VEGA_SKY;
  var doc = document, body = doc.body;
  var $ = function (s, r) { return (r || doc).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); };
  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var STORE_KEY = "vega.homework.v1";

  /* ---------------------------------------------------------------- 小工具 */
  function list(v) { return Array.isArray(v) ? v.filter(function (s) { return typeof s === "string" && s.trim(); }) : (typeof v === "string" && v.trim() ? [v] : []); }
  function el(tag, cls, text) { var e = doc.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var CN = "〇一二三四五六七八九";
  function cnYear(y) { return String(y).split("").map(function (d) { return CN[+d]; }).join(""); }
  function cnMonth(m) { return m <= 10 ? (m === 10 ? "十" : CN[m]) : "十" + CN[m - 10]; }
  function writtenDate() { var w = G.written || {}; return w.year ? cnYear(w.year) + "年" + (w.month ? cnMonth(w.month) + "月" : "") : ""; }

  var store = {
    data: {},
    load: function () { try { this.data = JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch (e) { this.data = {}; } return this.data; },
    save: function () { try { localStorage.setItem(STORE_KEY, JSON.stringify(this.data)); } catch (e) { /* 隐私模式下存不了，不影响礼物 */ } }
  };
  store.load();

  /* ---------------------------------------------------------------- 填内容 */
  var teacher = G.teacher || "老师";
  var teacherTitle = G.teacherTitle || teacher + "老师";
  var signLine = (G.senderRole || "您的学生") + (G.senderName ? "　" + G.senderName : "");

  doc.title = "给" + teacherTitle + " · 一份没人布置的作业";
  $("#doc-title").textContent = "给" + teacherTitle + "的课外作业";

  $$("[data-if]").forEach(function (n) { if (!G[n.getAttribute("data-if")]) n.hidden = true; });
  $$("[data-text]").forEach(function (n) { var v = G[n.getAttribute("data-text")]; n.textContent = v == null ? "" : v; });

  // “维 嘉”写在 Vega 上方：每个字一格，均匀摊开
  (function () {
    var ruby = $(".staff .ruby"), latin = $(".staff .latin");
    var word = el("span", "word");
    ruby.textContent = "";
    teacher.split("").forEach(function (ch) { ruby.appendChild(el("span", null, ch)); });
    latin.parentNode.insertBefore(word, latin);
    word.appendChild(ruby); word.appendChild(latin);
    var sr = el("span", "sr-only", "（上面用铅笔注了音：" + teacher + "）");
    word.appendChild(sr);
  })();

  $$("[data-lines]").forEach(function (box) {
    list(G[box.getAttribute("data-lines")]).forEach(function (s) { box.appendChild(el("p", null, s)); });
  });

  if (G.showPhotoPage === false) { $("#n4 .photo").hidden = true; $('#n4 [data-lines="photo"]').hidden = true; }

  /* ---------------------------------------------------------------- 作文格
     规则照着真的作文纸来：段首空两格；一字一格；英文两个字母一格；
     句末标点不能顶格，挤在上一行最后一格的右下角。 */
  var COLS = 12;
  var CLOSE = "，。、；：？！”’）》」』";
  var OPEN = "“‘（《「『";

  function tokens(text) {
    var out = [], i = 0, m;
    while (i < text.length) {
      var rest = text.slice(i);
      if ((m = /^[A-Za-z0-9.'\-]+/.exec(rest))) {
        for (var k = 0; k < m[0].length; k += 2) out.push({ s: m[0].slice(k, k + 2), lat: true });
        i += m[0].length;
      } else if (text[i] === "　") { out.push({ s: "" }); i += 1; }       // 全角空格：空一格
      else if (/^\s/.test(rest)) { i += 1; }
      else { out.push({ s: text[i] }); i += 1; }
    }
    return out;
  }

  function Grid(box, seed) {
    this.box = box; this.rand = rng(seed); this.row = null; this.col = 0; this.last = null;
    box.setAttribute("aria-hidden", "true");
  }
  Grid.prototype.newRow = function () {
    this.row = el("div", "row"); this.col = 0; this.box.appendChild(this.row);
    for (var i = 0; i < COLS; i++) this.row.appendChild(el("span", "c"));
    return this.row;
  };
  Grid.prototype.put = function (tk) {
    if (!this.row || this.col >= COLS) this.newRow();
    var cell = this.row.children[this.col++];
    var b = el("b", null, tk.s);
    var r = this.rand, rot = (r() - .5) * 3.2, dx = (r() - .5) * 5, dy = (r() - .5) * 5;
    if (tk.lat) cell.className += " lat";
    b.style.transform = "translate(" + dx.toFixed(1) + "%," + dy.toFixed(1) + "%) rotate(" + rot.toFixed(2) + "deg)";
    cell.appendChild(b);
    this.last = cell;
    return cell;
  };
  Grid.prototype.para = function (text, indent) {
    this.row = null; this.col = COLS;                      // 每段另起一行
    var tks = tokens(text), self = this;
    if (indent) { this.newRow(); this.col = indent; }
    tks.forEach(function (tk) {
      var isClose = !tk.lat && CLOSE.indexOf(tk.s) >= 0, isOpen = !tk.lat && OPEN.indexOf(tk.s) >= 0;
      if (isClose && self.col >= COLS && self.last && !self.last.querySelector(".hang")) {
        self.last.appendChild(el("span", "hang", tk.s)); return;
      }
      if (isOpen && self.col === COLS - 1) self.col = COLS;  // 前引号不落在行尾
      self.put(tk);
    });
  };
  Grid.prototype.right = function (text) {                    // 落款：靠右
    var tks = tokens(text); this.newRow(); this.col = Math.max(0, COLS - tks.length);
    var self = this; tks.forEach(function (tk) { self.put(tk); });
  };
  Grid.prototype.dotRow = function (col) {
    this.newRow();
    var cell = this.row.children[col]; cell.appendChild(el("i", "dot")); cell.id = "vega-cell";
    this.col = COLS;
  };

  function srText(box, paras) {
    var p = el("div", "sr-only");
    paras.forEach(function (s) { p.appendChild(el("p", null, s)); });
    box.parentNode.insertBefore(p, box);
  }

  var grids = {};
  $$("[data-grid]").forEach(function (box, i) { grids[box.getAttribute("data-grid")] = new Grid(box, 1850 + i * 97); });

  (function fillGrids() {
    var opening = list(G.opening), after = list(G.afterName), g;

    g = grids.opening;
    g.para(teacherTitle + "：", 0);
    opening.forEach(function (s) { g.para(s, 2); });
    srText(g.box, [teacherTitle + "："].concat(opening));

    g = grids.afterName;
    after.forEach(function (s) { g.para(s, 2); });
    g.dotRow(6);
    srText(g.box, after.concat(["（这一行的格子里，只有一个小小的墨点。）"]));

    g = grids.lightsOff;
    list(G.lightsOffLine).forEach(function (s) { g.para(s, 2); });
    srText(g.box, list(G.lightsOffLine));

    var letter = list(G.letter).concat(list(G.memories));
    g = grids.letter;
    letter.forEach(function (s) { g.para(s, 2); });
    srText(g.box, letter);

    g = grids.letterEnd;
    list(G.letterEnd).forEach(function (s) { g.para(s, 2); });
    srText(g.box, list(G.letterEnd));

    g = grids.sign;
    g.right(signLine);
    if (writtenDate()) g.right(writtenDate());
    srText(g.box, [signLine, writtenDate()]);

    if (G.memoryPhoto) {
      var fig = $("#memory-photo"); fig.hidden = false;
      var img = $("img", fig); img.src = G.memoryPhoto; img.alt = G.memoryPhotoCaption || "一张照片";
      img.onerror = function () { fig.hidden = true; };
      $("figcaption", fig).textContent = G.memoryPhotoCaption || "";
    }
  })();

  /* ---------------------------------------------------------------- 二十五年 */
  var YEARS = 25, LIGHT_YEARS = 25.04;
  var journey = $("#journey");
  (function buildJourney() {
    var w = G.written || {}, y0 = w.year || new Date().getFullYear();
    var top = el("div", "j-end from"); top.appendChild(el("i")); top.appendChild(el("span", null, "织女一"));
    journey.appendChild(top);
    for (var k = 1; k <= YEARS; k++) {
      var t = el("div", "tick" + (k % 5 === 0 ? " major" : ""));
      t.appendChild(el("i")); t.appendChild(el("span", null, String(y0 + k)));
      if (k === YEARS) t.appendChild(el("em", null, "大约这一年，到。"));
      journey.appendChild(t);
    }
    var here = el("div", "j-end here"); here.appendChild(el("i")); here.appendChild(el("span", null, "这里")); journey.appendChild(here);

    var dep = new Date(y0, (w.month || 1) - 1, 15), now = new Date();
    var years = Math.max(0, (now - dep) / (365.2425 * 864e5));
    var label;
    if (years >= LIGHT_YEARS) label = "那束光，已经到了";
    else if (years < 0.17) label = "那束光刚出发";
    else {
      var yy = Math.floor(years), mm = Math.floor((years - yy) * 12);
      label = "那束光已经走了" + (yy ? " " + yy + " 年" : "") + (mm ? " " + mm + " 个月" : "");
    }
    var nowEl = el("div", "j-now"); nowEl.appendChild(el("i")); nowEl.appendChild(el("span", null, label)); journey.appendChild(nowEl);
    journey._frac = Math.min(1, years / LIGHT_YEARS);
    journey._now = nowEl;
    $("#journey-text").textContent = "一条从织女一画到“这里”的线，上面标着 " + y0 + " 到 " + (y0 + YEARS) + " 年的刻度。" + label + "。大约 " + (y0 + YEARS) + " 年到。";
  })();
  function placeNow() {
    var ticks = $$(".tick", journey), top = $(".j-end", journey);
    if (!ticks.length) return;
    var y0 = top.offsetTop + top.offsetHeight / 2, y1 = ticks[ticks.length - 1].offsetTop + ticks[0].offsetHeight / 2;
    var minY = y0 + ticks[0].offsetHeight * .42;            // 刚出发时也看得出它已经离开了
    journey._now.style.top = Math.max(minY, y0 + (y1 - y0) * journey._frac) + "px";
  }

  /* ---------------------------------------------------------------- 星图 */
  var p1 = $("#p1"), skyCanvas = $(".sky", p1), pointing = $(".pointing", p1), lyraLabel = $(".sky-lyra", p1);
  var skyState = { w: 0, h: 0, cx: 0, cy: 0, k: 1, drawn: -1, raf: 0 };

  function bvTint(bv) {            // 蓝晒纸上的星几乎都是白的，只留一点点冷暖
    var t = Math.max(-0.2, Math.min(1.6, bv || 0));
    if (t < 0.3) return [232 + t * 40, 242, 255];
    return [255, 246 - (t - .3) * 14, 236 - (t - .3) * 30];
  }

  /* 把星画到任意 2D 画布上（屏幕与纪念页共用）。
     o: { cx, cy 织女一的像素位置；scale 每单位像素；w,h；px 线宽基准；progress 0..1；lyra } */
  function paintSky(ctx, o) {
    if (!SKY) return;
    var S = SKY.stars, F = SKY.faint, p = o.progress == null ? 1 : o.progress, px = o.px || 1, i, x, y, a;
    ctx.save();
    // 更暗的星：一粒一粒的小点
    for (i = 0; i < F.length; i += 3) {
      x = o.cx + F[i] / 1e4 * o.scale; y = o.cy + F[i + 1] / 1e4 * o.scale;
      if (x < -2 || y < -2 || x > o.w + 2 || y > o.h + 2) continue;
      var m = F[i + 2] / 10;
      a = Math.max(0, Math.min(1, (p - .55) * 3)) * Math.max(.16, Math.min(.6, (8.2 - m) / 3));
      if (a <= 0) continue;
      ctx.globalAlpha = a; ctx.fillStyle = "#eaf2f8";
      var s = (m < 6.8 ? 1.25 : .95) * px;
      ctx.fillRect(x - s / 2, y - s / 2, s, s);
    }
    // 天琴座的连线：很淡的虚线
    if (o.lyra && SKY.lyra) {
      a = Math.max(0, Math.min(1, (p - .8) * 5));
      if (a > 0) {
        ctx.globalAlpha = .3 * a; ctx.strokeStyle = "#eaf2f8"; ctx.lineWidth = .9 * px;
        ctx.setLineDash([3 * px, 4 * px]); ctx.beginPath();
        SKY.lyra.forEach(function (pt, j) { var X = o.cx + pt[0] * o.scale, Y = o.cy + pt[1] * o.scale; if (j) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); });
        ctx.stroke(); ctx.setLineDash([]);
      }
    }
    for (i = 0; i < S.length; i++) {
      if (i === SKY.vega) continue;
      x = o.cx + S[i][0] * o.scale; y = o.cy + S[i][1] * o.scale;
      if (x < -8 || y < -8 || x > o.w + 8 || y > o.h + 8) continue;
      var mag = S[i][2];
      a = Math.max(0, Math.min(1, (p * 1.25 - mag / 7.2) * 5));   // 亮的先出来
      if (a <= 0) continue;
      var r = (.55 + Math.pow(Math.max(0, 6.4 - mag), 1.2) * .3) * px, c = bvTint(S[i][3]);
      ctx.globalAlpha = a * Math.min(1, .5 + (6.6 - mag) * .14);
      ctx.fillStyle = "rgb(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + ")";
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
      if (mag < 3.2) { ctx.globalAlpha *= .16; ctx.beginPath(); ctx.arc(x, y, r * 2.6, 0, 6.2832); ctx.fill(); }
    }
    // 织女一：原来是格子里的那个墨点
    var grow = .35 + .65 * Math.min(1, p * 1.6), R = 4.4 * px * grow;
    var halo = ctx.createRadialGradient(o.cx, o.cy, R * .6, o.cx, o.cy, R * 6.5);
    halo.addColorStop(0, "rgba(226,240,255,.42)"); halo.addColorStop(.35, "rgba(200,225,250,.12)"); halo.addColorStop(1, "rgba(200,225,250,0)");
    ctx.globalAlpha = Math.min(1, p * 2); ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(o.cx, o.cy, R * 6.5, 0, 6.2832); ctx.fill();
    ctx.globalAlpha = 1; ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(o.cx, o.cy, R, 0, 6.2832); ctx.fill();
    ctx.restore();
  }

  function measureSky() {
    var rect = p1.getBoundingClientRect(), cell = $("#vega-cell");
    if (!cell) return;
    var d = $(".dot", cell).getBoundingClientRect();
    var w = p1.offsetWidth, h = p1.offsetHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    while (w * dpr * h * dpr > 5.5e6 && dpr > 1) dpr -= .25;
    skyState.w = w; skyState.h = h; skyState.dpr = dpr;
    skyState.cx = d.left + d.width / 2 - rect.left; skyState.cy = d.top + d.height / 2 - rect.top;
    skyState.scale = w / 17.5 * 57.2958;                    // 纸宽 ≈ 17.5°
    skyCanvas.width = Math.round(w * dpr); skyCanvas.height = Math.round(h * dpr);
    pointing.style.transform = "translate(" + skyState.cx + "px," + skyState.cy + "px)";
    lyraLabel.style.left = (skyState.cx - .064 * skyState.scale) + "px";
    lyraLabel.style.top = (skyState.cy + .128 * skyState.scale) + "px";
    skyState.drawn = -1;
  }
  function drawSky(progress) {
    var ctx = skyCanvas.getContext("2d"), s = skyState;
    ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    ctx.clearRect(0, 0, s.w, s.h);
    paintSky(ctx, { cx: s.cx, cy: s.cy, scale: s.scale, w: s.w, h: s.h, px: Math.max(1, s.w / 390), progress: progress, lyra: true });
    s.drawn = progress;
  }
  function revealSky() {
    cancelAnimationFrame(skyState.raf);
    if (!skyState.w) measureSky();
    if (reduced) { drawSky(1); p1.classList.add("sky-ready"); return; }
    var t0 = performance.now(), DUR = 2600;
    (function step(t) {
      var p = Math.min(1, (t - t0) / DUR);
      drawSky(p);
      if (p > .72) p1.classList.add("sky-ready");
      if (p < 1) skyState.raf = requestAnimationFrame(step);
    })(t0);
  }

  /* ---------------------------------------------------------------- 灯 */
  var switches = $$("[data-switch]");
  var light = "on";
  function setLight(v, opts) {
    if (v === light) return;
    light = v; body.setAttribute("data-light", v);
    switches.forEach(function (b) {
      b.setAttribute("aria-pressed", v === "off" ? "true" : "false");
      b.setAttribute("aria-label", v === "off" ? "开灯" : "关灯");
    });
    var meta = $('meta[name="theme-color"]'); if (meta) meta.content = v === "off" ? "#08121e" : "#cdc5b3";
    if (v === "off") revealSky();
    else { cancelAnimationFrame(skyState.raf); p1.classList.remove("sky-ready"); }
    if (opts && opts.silent) return;
  }
  switches.forEach(function (b) { b.setAttribute("aria-label", "关灯"); });

  function scrollToY(y, smooth) {
    y = Math.max(0, y);
    try { window.scrollTo({ top: y, behavior: smooth && !reduced ? "smooth" : "auto" }); } catch (e) { window.scrollTo(0, y); }
  }
  function docTop(n) { return n.getBoundingClientRect().top + window.pageYOffset; }

  switches[0].addEventListener("click", function () {
    if (light === "on") {
      setLight("off");
      var d = $("#vega-cell");                               // 把那个点放到视线偏上的位置
      scrollToY(docTop(d) - window.innerHeight * .4, true);
    } else setLight("on");
  });
  switches[1].addEventListener("click", function () {
    if (light === "off") { setLight("on"); zone.prev = "post"; scrollToY(docTop($("#letter")) - 6, true); }
    else setLight("off");
  });

  // 不按开关、只是往下滑，灯也会在该关的地方关、该开的地方开
  var zone = { prev: "pre", mute: false };
  function currentZone() {
    var mark = window.pageYOffset + window.innerHeight * .55;
    if (mark >= docTop($("#letter"))) return "post";
    if (mark >= docTop($("#n2"))) return "night";
    return "pre";
  }
  function onScroll() {
    if (body.classList.contains("is-closed")) return;
    var z = currentZone();
    if (z !== zone.prev) {
      if (!zone.mute) {
        if (z === "night" && (zone.prev === "pre" || zone.prev === "post")) setLight("off");
        else if (z === "post") setLight("on");
      }
      zone.prev = z;
    }
  }
  var ticking = false;
  window.addEventListener("scroll", function () {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () { ticking = false; onScroll(); });
  }, { passive: true });

  /* ---------------------------------------------------------------- 银版：慢慢地、不声张地曝光 */
  var plate = $("#plate");
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es, io) {
      es.forEach(function (e) { if (e.isIntersecting) { plate.classList.add("exposing"); io.disconnect(); } });
    }, { threshold: .4 }).observe(plate);
  } else plate.classList.add("exposing");

  /* ---------------------------------------------------------------- 封面 */
  var cover = $("#cover"), book = $("#book");
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  function setInert(n, v) { if (v) { n.setAttribute("inert", ""); n.setAttribute("aria-hidden", "true"); } else { n.removeAttribute("inert"); n.removeAttribute("aria-hidden"); } }
  setInert(book, true); setInert($("#back"), true);

  function openCover(then) {
    if (!body.classList.contains("is-closed")) return;
    body.classList.remove("is-closed"); cover.classList.add("is-open");
    setInert(book, false); setInert($("#back"), false); setInert(cover, true);
    store.data.opened = true; store.save();
    requestAnimationFrame(function () { measureSky(); placeNow(); if (then) then(); else p1.focus({ preventScroll: true }); });
  }
  function closeCover() {
    zone.mute = true; setLight("on"); scrollToY(0, false); zone.prev = "pre"; zone.mute = false;
    body.classList.add("is-closed"); cover.classList.remove("is-open");
    setInert(book, true); setInert($("#back"), true); setInert(cover, false);
    refreshResume();
    setTimeout(function () { $("#open-btn").focus({ preventScroll: true }); }, 50);
  }
  $("#open-btn").addEventListener("click", function () { openCover(); });
  (function swipeToOpen() {
    var y0 = null;
    cover.addEventListener("touchstart", function (e) { y0 = e.touches[0].clientY; }, { passive: true });
    cover.addEventListener("touchmove", function (e) { if (y0 != null && y0 - e.touches[0].clientY > 36) { y0 = null; openCover(); } }, { passive: true });
    cover.addEventListener("wheel", function (e) { if (e.deltaY > 8) openCover(); }, { passive: true });
    doc.addEventListener("keydown", function (e) {
      if (!body.classList.contains("is-closed")) return;
      if (e.key === "ArrowDown" || e.key === "PageDown") openCover();
    });
  })();
  function jumpTo(id) {
    zone.mute = true;
    scrollToY(docTop($(id)) - 6, false);
    zone.prev = currentZone(); zone.mute = false;
  }
  var resumeBtn = $("#resume-btn");
  function refreshResume() { resumeBtn.hidden = !(store.data.review && store.data.review.mode); }
  refreshResume();
  resumeBtn.addEventListener("click", function () { openCover(function () { jumpTo("#review"); }); });
  $("#again").addEventListener("click", closeCover);

  /* ---------------------------------------------------------------- 红笔 */
  var area = $("#review-area"), ink = $("#ink"), seal = $("#seal"), dateEl = $("#review-date");
  var actions = $("#review-actions");
  var review = { mode: null, strokes: [], at: null };
  var INK = "rgba(207,42,31,.93)";

  function fmtDate(iso) { var d = new Date(iso); return d.getFullYear() + " 年 " + (d.getMonth() + 1) + " 月 " + d.getDate() + " 日"; }
  function todayISO() { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).toISOString(); }

  /* 画一组笔画。pts 的 x、y 都以批阅栏宽度为 1 归一化，所以放大到纪念页上不会走形。
     笔速越快线越细——中性笔写快了就是这样。 */
  function paintStrokes(ctx, strokes, ox, oy, W) {
    ctx.save(); ctx.strokeStyle = INK; ctx.fillStyle = INK; ctx.lineCap = "round"; ctx.lineJoin = "round";
    var base = W * .0105;
    strokes.forEach(function (pts) {
      if (!pts.length) return;
      if (pts.length < 3) {
        ctx.beginPath(); ctx.arc(ox + pts[0][0] * W, oy + pts[0][1] * W, base * .6, 0, 6.2832); ctx.fill();
        if (pts.length === 2) { ctx.lineWidth = base; ctx.beginPath(); ctx.moveTo(ox + pts[0][0] * W, oy + pts[0][1] * W); ctx.lineTo(ox + pts[1][0] * W, oy + pts[1][1] * W); ctx.stroke(); }
        return;
      }
      var w = 1, mx = ox + pts[0][0] * W, my = oy + pts[0][1] * W;
      for (var i = 1; i < pts.length; i++) {
        var a = pts[i - 1], b = pts[i];
        var dt = Math.max(4, b[2] - a[2]), sp = Math.hypot(b[0] - a[0], b[1] - a[1]) / dt;
        var target = Math.max(.5, Math.min(1.3, 1.32 - sp * 250));
        w += (target - w) * .3;
        var nx = ox + (a[0] + b[0]) / 2 * W, ny = oy + (a[1] + b[1]) / 2 * W;
        ctx.lineWidth = base * w;
        ctx.beginPath(); ctx.moveTo(mx, my); ctx.quadraticCurveTo(ox + a[0] * W, oy + a[1] * W, nx, ny); ctx.stroke();
        mx = nx; my = ny;
      }
      var z = pts[pts.length - 1];
      ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(ox + z[0] * W, oy + z[1] * W); ctx.stroke();
    });
    ctx.restore();
  }

  var inkRaf = 0;
  function sizeInk() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2.5), w = area.clientWidth, h = area.clientHeight;
    if (!w) return;
    ink.width = Math.round(w * dpr); ink.height = Math.round(h * dpr); ink._dpr = dpr; ink._w = w; ink._h = h;
    redrawInk();
  }
  function redrawInk() {
    if (!ink._w) return;
    var ctx = ink.getContext("2d");
    ctx.setTransform(ink._dpr, 0, 0, ink._dpr, 0, 0); ctx.clearRect(0, 0, ink._w, ink._h);
    if (review.mode !== "seal") paintStrokes(ctx, review.strokes, 0, 0, ink._w);
  }
  function requestInk() { if (!inkRaf) inkRaf = requestAnimationFrame(function () { inkRaf = 0; redrawInk(); }); }

  function showState(name) {
    $$(".ra", actions).forEach(function (n) { n.hidden = !n.classList.contains("ra-" + name); });
    area.classList.toggle("writing", name === "writing");
    area.classList.toggle("done", name === "done");
    $(".review-skip", actions).hidden = name !== "idle";
    seal.hidden = review.mode !== "seal";
    dateEl.hidden = !(name === "done" && review.at);
    if (review.at) dateEl.textContent = "批阅　" + fmtDate(review.at);
    ink.setAttribute("aria-label", name === "done" ? "批阅栏：已经批阅过了" : "批阅栏：可以用红笔在这里写画");
  }
  function persistReview() {
    store.data.review = review.mode ? {
      mode: review.mode, at: review.at,
      strokes: review.strokes.map(function (s) { return s.map(function (p) { return [+p[0].toFixed(4), +p[1].toFixed(4), Math.round(p[2])]; }); })
    } : null;
    store.save();
  }

  var active = null;
  function ptOf(e) { var r = ink.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.width, e.timeStamp]; }
  ink.addEventListener("pointerdown", function (e) {
    if (!area.classList.contains("writing") || active) return;
    e.preventDefault();
    try { ink.setPointerCapture(e.pointerId); } catch (err) {}
    active = { id: e.pointerId, pts: [ptOf(e)] }; review.strokes.push(active.pts); requestInk();
  });
  ink.addEventListener("pointermove", function (e) {
    if (!active || e.pointerId !== active.id) return;
    e.preventDefault();
    var evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e]; if (!evs.length) evs = [e];
    evs.forEach(function (ev) {
      var p = ptOf(ev), q = active.pts[active.pts.length - 1];
      if (Math.hypot(p[0] - q[0], p[1] - q[1]) > .004) active.pts.push(p);
    });
    requestInk();
  });
  function endStroke(e) { if (active && e.pointerId === active.id) { active = null; requestInk(); } }
  ink.addEventListener("pointerup", endStroke); ink.addEventListener("pointercancel", endStroke);

  function takePen() { if (review.mode === "seal") { review.mode = null; } showState("writing"); sizeInk(); $("#done-pen").focus({ preventScroll: true }); }
  $("#take-pen").addEventListener("click", takePen);
  $("#pen").addEventListener("click", takePen);
  $("#undo").addEventListener("click", function () { review.strokes = []; redrawInk(); });
  $("#done-pen").addEventListener("click", function () {
    review.strokes = review.strokes.filter(function (s) { return s.length; });
    if (!review.strokes.length) { review.mode = null; showState("idle"); persistReview(); return; }
    review.mode = "draw"; review.at = review.at || todayISO();
    showState("done"); persistReview(); $("#keep").focus({ preventScroll: true });
  });
  $("#use-seal").addEventListener("click", function () {
    review.mode = "seal"; review.strokes = []; review.at = todayISO();
    redrawInk(); showState("done"); persistReview(); $("#keep").focus({ preventScroll: true });
  });
  $("#redo").addEventListener("click", function () {
    review.mode = null; review.strokes = []; review.at = null; redrawInk(); showState("idle"); persistReview();
  });

  (function restoreReview() {
    var r = store.data.review;
    if (r && r.mode) { review.mode = r.mode; review.strokes = r.strokes || []; review.at = r.at || null; showState("done"); }
    else showState("idle");
  })();

  /* ---------------------------------------------------------------- 对话层 */
  function openDialog(d) {
    if (typeof d.showModal === "function") { try { d.showModal(); } catch (e) { d.setAttribute("open", ""); d.classList.add("dlg-fallback"); } }
    else { d.setAttribute("open", ""); d.classList.add("dlg-fallback"); }
    d.scrollTop = 0;
  }
  function closeDialog(d) { if (typeof d.close === "function" && d.open && !d.classList.contains("dlg-fallback")) d.close(); else { d.removeAttribute("open"); d.classList.remove("dlg-fallback"); } }
  $$("[data-close]").forEach(function (b) { b.addEventListener("click", function () { closeDialog(b.closest("dialog")); }); });

  function plainParas() {
    var out = [];
    function add(arr, cls) { list(arr).forEach(function (s) { out.push({ s: s, cls: cls }); }); }
    out.push({ s: "题目：" + (G.title || ""), cls: "no-indent" });
    out.push({ s: teacherTitle + "：", cls: "no-indent" });
    add(G.opening);
    out.push({ s: "Vega（" + teacher + "）　" + (G.phoneticNote || ""), cls: "no-indent" });
    add(G.afterName); add(G.lightsOffLine);
    out.push({ hr: true });
    add(G.pointing); add(G.distance);
    out.push({ s: "大约" + cnYear(((G.written || {}).year || new Date().getFullYear()) + YEARS) + "年，它们会到。" });
    add(G.arrival); add(G.plate); add(G.plateAfter); add(G.photo); add(G.lightsOnLine);
    out.push({ hr: true });
    add(G.letter); add(G.memories); add(G.letterEnd);
    out.push({ s: signLine, cls: "right" });
    if (writtenDate()) out.push({ s: writtenDate(), cls: "right" });
    out.push({ hr: true });
    add(G.review); add(G.goodbye);
    return out;
  }
  $("#open-plain").addEventListener("click", function () {
    var box = $("#plain-text"); box.textContent = "";
    plainParas().forEach(function (p) { box.appendChild(p.hr ? el("hr") : el("p", p.cls, p.s)); });
    openDialog($("#plain-dialog"));
  });
  $("#open-credits").addEventListener("click", function () { openDialog($("#credits-dialog")); });

  /* ---------------------------------------------------------------- 版面变化 */
  var rz = 0;
  function relayout() {
    measureSky(); placeNow(); sizeInk();
    if (light === "off") { drawSky(1); p1.classList.add("sky-ready"); }
  }
  window.addEventListener("resize", function () { clearTimeout(rz); rz = setTimeout(relayout, 160); });
  window.addEventListener("orientationchange", function () { clearTimeout(rz); rz = setTimeout(relayout, 300); });
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(relayout);
  window.addEventListener("load", relayout);
  sizeInk(); placeNow();

  /* ---------------------------------------------------------------- 给纪念页用 */
  window.VegaHomework = {
    G: G, review: review, teacherTitle: teacherTitle, signLine: signLine, writtenDate: writtenDate,
    fmtDate: fmtDate, paintSky: paintSky, paintStrokes: paintStrokes, tokens: tokens,
    openDialog: openDialog, closeDialog: closeDialog, rng: rng, areaRatio: function () { return area.clientHeight / Math.max(1, area.clientWidth); }
  };
})();
