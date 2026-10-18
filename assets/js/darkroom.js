/* Original campus instrument. Native Pointer/Canvas/Web Audio, no tracking or CDN.
   Interaction research and source/license distinctions: docs/creative-darkroom-20261018.md. */
(() => {
  "use strict";
  const C = window.HaizDarkroomCore,
    $ = (id) => document.getElementById(id),
    key = "haiz.darkroom.score.v1",
    defaultNote = "愿你经过这里的时候，刚好有风。";
  const motion = matchMedia("(prefers-reduced-motion: reduce)"),
    notes = [523.251, 130.813, 391.995, 0];
  let score = C.preset("shade"),
    saveEnabled = true,
    saveFailed = false,
    shared = false,
    badHash = false;
  try {
    const saved = JSON.parse(localStorage.getItem(key) || "null");
    if (saved?.v === 1) score = C.clean(saved);
  } catch {
    saveFailed = true;
  }
  function incoming() {
    if (!location.hash.startsWith("#score=")) return;
    const value = C.decode(location.hash.slice(7));
    if (value) {
      score = value;
      shared = true;
      badHash = false;
    } else badHash = true;
  }
  incoming();
  let photo = C.places.find((p) => p.id === score.place),
    ctx = null,
    master = null,
    playing = false,
    interval = null,
    nextTime = 0,
    nextStep = 0,
    epoch = 0,
    volume = 0.35,
    activeSources = new Set(),
    visualTimers = new Set(),
    playedSteps = 0,
    paint = null,
    dragPointer = null,
    touchTap = null,
    touchClickUntil = 0,
    strokePointer = null,
    lastPoint = null,
    points = [],
    brushFrame = 0;
  const grid = $("scoreGrid"),
    canvas = $("revealCanvas"),
    stage = $("revealStage"),
    mask = canvas.getContext("2d");
  $("postcardPhoto").loading = "eager";
  const placeButtons = C.places.map((p, i) => {
    const button = document.createElement("button");
    button.className = "room-place";
    button.type = "button";
    button.dataset.place = p.id;
    button.setAttribute("aria-pressed", "false");
    const image = new Image();
    image.src = p.image;
    image.alt = "";
    image.loading = "lazy";
    button.append(image, document.createTextNode(p.name));
    button.onclick = () => {
      score.place = p.id;
      saveEnabled = true;
      resetReveal();
      render(true);
    };
    $("roomPlaces").append(button);
    return button;
  });
  const corner = document.createElement("span");
  corner.className = "room-score-column";
  corner.textContent = "地点 / 合成声部";
  grid.append(corner);
  for (let step = 0; step < 8; step++) {
    const label = document.createElement("span");
    label.className = "room-score-column";
    label.dataset.column = step;
    label.textContent = String(step + 1).padStart(2, "0");
    grid.append(label);
  }
  const cells = [];
  C.places.forEach((p, row) => {
    const label = document.createElement("div");
    label.className = "room-score-row";
    const audition = document.createElement("button");
    audition.type = "button";
    audition.textContent = "♫";
    audition.setAttribute("aria-label", "试听" + p.name + "的合成声音");
    audition.onclick = async () => {
      try {
        await unlock();
        if (!document.hidden) {
          master.gain.value = volume;
          voice(ctx, master, row, ctx.currentTime + 0.01);
          $("audioStatus").textContent =
            p.voice + " · 合成试听，不是现场录音。";
        }
      } catch {
        audioError();
      }
    };
    const text = document.createElement("div"),
      strong = document.createElement("strong"),
      small = document.createElement("small");
    strong.textContent = p.voice;
    small.textContent = p.type;
    text.append(strong, small);
    label.append(audition, text);
    grid.append(label);
    for (let step = 0; step < 8; step++) {
      const button = document.createElement("button");
      button.className = "room-step";
      button.type = "button";
      button.dataset.row = row;
      button.dataset.step = step;
      button.setAttribute("aria-label", p.name + " · 第 " + (step + 1) + " 拍");
      button.setAttribute("aria-pressed", "false");
      button.addEventListener("pointerdown", (e) => {
        if (e.button !== 0 || dragPointer !== null) return;
        if (e.pointerType === "touch") {
          if (!touchTap)
            touchTap = {
              id: e.pointerId,
              row,
              step,
              x: e.clientX,
              y: e.clientY,
              moved: false,
            };
          return;
        }
        e.preventDefault();
        dragPointer = e.pointerId;
        paint = !C.active(score, row, step);
        grid.setPointerCapture(e.pointerId);
        setCell(row, step, paint);
      });
      button.addEventListener("click", (e) => {
        if (
          e.detail > 0 &&
          (e.pointerType ||
            e.sourceCapabilities?.firesTouchEvents ||
            performance.now() < touchClickUntil)
        )
          return;
        setCell(row, step);
      });
      grid.append(button);
      cells.push(button);
    }
  });
  function setCell(row, step, value) {
    score = C.toggle(score, row, step, value);
    saveEnabled = true;
    render();
  }
  grid.addEventListener("pointermove", (e) => {
    if (
      touchTap?.id === e.pointerId &&
      Math.hypot(e.clientX - touchTap.x, e.clientY - touchTap.y) > 10
    )
      touchTap.moved = true;
    if (e.pointerId !== dragPointer) return;
    const cell = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest(".room-step");
    if (cell)
      setCell(Number(cell.dataset.row), Number(cell.dataset.step), paint);
  });
  function endPaint(e) {
    if (touchTap?.id === e.pointerId) {
      touchClickUntil = performance.now() + 800;
      if (e.type === "pointerup" && !touchTap.moved)
        setCell(touchTap.row, touchTap.step);
      touchTap = null;
    }
    if (e.pointerId !== dragPointer) return;
    dragPointer = null;
    paint = null;
  }
  grid.addEventListener("pointerup", endPaint);
  grid.addEventListener("pointercancel", endPaint);
  grid.addEventListener("lostpointercapture", endPaint);
  function persist() {
    if (!saveEnabled) return;
    try {
      localStorage.setItem(key, JSON.stringify(C.clean(score)));
      saveFailed = false;
    } catch {
      saveFailed = true;
      $("mailStatus").textContent =
        "浏览器不允许本地保存。当前创作仍可播放、导出或复制链接带走。";
    }
    // A received score is also the address of the remix. Keep refresh from
    // restoring the original after the visitor has actually edited it.
    if (shared && location.hash.startsWith("#score=")) {
      try {
        history.replaceState(null, "", shareURL());
      } catch {}
    }
  }
  document.addEventListener("click", (event) => {
    const anchor = event.target.closest('a[href^="#"]');
    if (!anchor || !shared || !location.hash.startsWith("#score=")) return;
    if (
      event.button ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const section = document.getElementById(anchor.hash.slice(1));
    if (!section) return;
    event.preventDefault();
    section.scrollIntoView({
      behavior: motion.matches ? "auto" : "smooth",
      block: "start",
    });
  });
  function shareURL() {
    const url = new URL(location.href);
    url.search = "";
    url.hash = "score=" + C.encode(score);
    return url.href;
  }
  function render(changePhoto = false, shouldSave = true) {
    score = C.clean(score);
    photo = C.places.find((p) => p.id === score.place);
    if (changePhoto) {
      $("roomPhoto").src = photo.image;
      $("roomPhoto").alt = photo.alt;
      $("photoCaption").textContent = photo.name + " / " + photo.en;
      $("placeName").textContent = photo.name;
      $("placeObservation").textContent = photo.observation;
      $("placePoem").replaceChildren(
        ...photo.poem.flatMap((line, i) =>
          i
            ? [document.createElement("br"), document.createTextNode(line)]
            : [document.createTextNode(line)],
        ),
      );
      $("placeNumber").textContent =
        "0" + (C.places.indexOf(photo) + 1) + " / 04";
      $("placeWalk").href = "campus-3d.html?focus=" + photo.id + "&observe=1";
      $("postcardPhoto").src = photo.image;
      $("postcardPhoto").alt = "作品选用的" + photo.name + "完整实拍";
    }
    for (const b of placeButtons)
      b.setAttribute("aria-pressed", String(b.dataset.place === score.place));
    for (const b of cells)
      b.setAttribute(
        "aria-pressed",
        String(C.active(score, Number(b.dataset.row), Number(b.dataset.step))),
      );
    $("scoreTempo").value = score.tempo;
    $("tempoValue").textContent = score.tempo;
    if ($("roomNote").value !== score.note) $("roomNote").value = score.note;
    $("noteCount").textContent = Array.from(score.note).length;
    $("postcardPreview").dataset.paper = score.paper;
    $("postcardNote").textContent = score.note || defaultNote;
    $("postcardPlace").textContent = photo.name + " · " + score.tempo + " BPM";
    $("scoreCode").textContent = "NO. " + C.code(score);
    for (const b of document.querySelectorAll("[data-paper]"))
      if (b.tagName === "BUTTON")
        b.setAttribute("aria-pressed", String(b.dataset.paper === score.paper));
    $("postcardScore").replaceChildren(
      ...Array.from({ length: 32 }, (_, i) => {
        const dot = document.createElement("i");
        if (C.active(score, Math.floor(i / 8), i % 8)) dot.className = "on";
        return dot;
      }),
    );
    $("scoreLink").value = shareURL();
    $("remixState").textContent = shared
      ? "你接到了一份作品。改变一拍，寄出你的续写；不会实时修改对方的版本。"
      : "这是一份只在你浏览器里保存的创作。";
    if (shouldSave) persist();
  }
  function resizeMask() {
    const r = stage.getBoundingClientRect(),
      dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    drawMask();
  }
  function erase(p, previous) {
    const radius = canvas.width * (innerWidth < 700 ? 0.095 : 0.065);
    mask.globalCompositeOperation = "destination-out";
    mask.lineWidth = radius * 2;
    mask.lineCap = "round";
    mask.lineJoin = "round";
    mask.beginPath();
    mask.moveTo(
      (previous || p).x * canvas.width,
      (previous || p).y * canvas.height,
    );
    mask.lineTo(p.x * canvas.width, p.y * canvas.height);
    mask.stroke();
    mask.beginPath();
    mask.arc(p.x * canvas.width, p.y * canvas.height, radius, 0, Math.PI * 2);
    mask.fill();
  }
  function drawMask() {
    mask.globalCompositeOperation = "source-over";
    mask.fillStyle = "#24463e";
    mask.fillRect(0, 0, canvas.width, canvas.height);
    mask.strokeStyle = "#e8ebd715";
    mask.lineWidth = 1;
    const gridSize = canvas.width / 12;
    for (let x = 0; x <= canvas.width; x += gridSize) {
      mask.beginPath();
      mask.moveTo(x, 0);
      mask.lineTo(x, canvas.height);
      mask.stroke();
    }
    for (let y = 0; y <= canvas.height; y += gridSize) {
      mask.beginPath();
      mask.moveTo(0, y);
      mask.lineTo(canvas.width, y);
      mask.stroke();
    }
    mask.fillStyle = "#000";
    mask.strokeStyle = "#000";
    let previous = null;
    for (const p of points) {
      erase(p, p.start ? null : previous);
      previous = p;
    }
  }
  function resetReveal() {
    points = [];
    lastPoint = null;
    strokePointer = null;
    $("traceScore").disabled = true;
    $("exposure").value = 28;
    applyExposure();
    drawMask();
    $("revealHint").hidden = false;
  }
  function applyExposure() {
    const value = Number($("exposure").value);
    canvas.style.opacity = String(1 - value / 100);
    $("exposureValue").textContent = value + "%";
    $("revealHint").hidden = value >= 65 || points.length > 0;
  }
  function brush(e, start = false) {
    const r = canvas.getBoundingClientRect(),
      p = {
        x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
        y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)),
        start,
      };
    if (
      lastPoint &&
      !start &&
      Math.hypot(p.x - lastPoint.x, p.y - lastPoint.y) < 0.006
    )
      return;
    if (points.length >= 1600) {
      $("exposure").value = 100;
      applyExposure();
      return;
    }
    points.push(p);
    erase(p, start ? null : lastPoint);
    lastPoint = p;
    $("revealHint").hidden = true;
    $("traceScore").disabled = false;
    if (
      !motion.matches &&
      ++brushFrame % 8 === 0 &&
      stage.querySelectorAll(".room-spark").length < 5
    ) {
      const ring = document.createElement("i");
      ring.className = "room-spark";
      ring.style.left = p.x * 100 + "%";
      ring.style.top = p.y * 100 + "%";
      stage.append(ring);
      const anim = ring.animate?.(
        [
          { opacity: 0.6, scale: 0.6 },
          { opacity: 0, scale: 3 },
        ],
        { duration: 700, easing: "ease-out" },
      );
      if (anim)
        anim.finished.then(() => ring.remove()).catch(() => ring.remove());
      else ring.remove();
    }
  }
  canvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || strokePointer !== null) return;
    e.preventDefault();
    strokePointer = e.pointerId;
    lastPoint = null;
    canvas.setPointerCapture(e.pointerId);
    brush(e, true);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (e.pointerId === strokePointer) brush(e);
  });
  function endBrush(e) {
    if (e.pointerId === strokePointer) {
      lastPoint = null;
      strokePointer = null;
    }
  }
  canvas.addEventListener("pointerup", endBrush);
  canvas.addEventListener("pointercancel", endBrush);
  canvas.addEventListener("lostpointercapture", endBrush);
  $("exposure").oninput = applyExposure;
  $("revealAll").onclick = () => {
    $("exposure").value = 100;
    applyExposure();
  };
  $("resetReveal").onclick = resetReveal;
  $("traceScore").onclick = () => {
    if (!points.length) return;
    stop(
      "你的显影笔触已译成八拍：左右位置对应节拍，上下位置对应四个声部。按播放听听。",
    );
    score.masks = C.trace(points);
    saveEnabled = true;
    render();
    $("compose").scrollIntoView({
      behavior: motion.matches ? "auto" : "smooth",
      block: "start",
    });
    $("scorePlay").focus({ preventScroll: true });
  };
  if (window.ResizeObserver) new ResizeObserver(resizeMask).observe(stage);
  else window.addEventListener("resize", resizeMask);
  // Finite, event-driven SVG progress: no custom scroll hijack or permanent RAF.
  let scrollFrame = 0;
  function thread() {
    scrollFrame = 0;
    const r = $("roomThread").closest("svg").getBoundingClientRect(),
      progress = Math.max(
        0,
        Math.min(1, (innerHeight - r.top) / (innerHeight + r.height)),
      );
    $("roomThread").style.strokeDashoffset = String(1800 * (1 - progress));
  }
  addEventListener(
    "scroll",
    () => {
      if (!scrollFrame && !motion.matches)
        scrollFrame = requestAnimationFrame(thread);
    },
    { passive: true },
  );
  addEventListener("resize", thread);
  thread();
  async function unlock() {
    if (!ctx) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw Error("Web Audio unavailable");
      ctx = new Audio();
      master = ctx.createGain();
      master.gain.value = volume;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") await ctx.resume();
    if (ctx.state !== "running") throw Error("Audio did not start");
    return ctx;
  }
  function voice(audio, destination, row, when, strength = 1) {
    const gain = audio.createGain(),
      duration = row === 0 ? 1.15 : row === 1 ? 0.6 : row === 2 ? 0.75 : 0.13;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(
      (row === 3 ? 0.1 : 0.17) * strength,
      when + 0.009,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    gain.connect(destination);
    const nodes = [gain],
      sources = [];
    function oscillator(type, freq, amount = 1) {
      const osc = audio.createOscillator(),
        level = audio.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, when);
      level.gain.value = amount;
      osc.connect(level);
      level.connect(gain);
      nodes.push(level);
      sources.push(osc);
      return osc;
    }
    if (row === 0) {
      oscillator("sine", notes[row]);
      oscillator("sine", notes[row] * 2.756, 0.23);
    }
    if (row === 1) {
      oscillator("sine", notes[row]);
      oscillator("triangle", notes[row] * 2, 0.12);
    }
    if (row === 2) {
      const osc = oscillator("sine", notes[row] * 1.7);
      osc.frequency.exponentialRampToValueAtTime(
        notes[row] * 0.65,
        when + 0.17,
      );
    }
    if (row === 3) {
      const buffer = audio.createBuffer(
          1,
          Math.ceil(audio.sampleRate * duration),
          audio.sampleRate,
        ),
        channel = buffer.getChannelData(0);
      let seed = 70919;
      for (let i = 0; i < channel.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        channel[i] = (seed / 2147483648 - 1) * 0.65;
      }
      const noise = audio.createBufferSource(),
        filter = audio.createBiquadFilter();
      noise.buffer = buffer;
      filter.type = "highpass";
      filter.frequency.value = 1700;
      noise.connect(filter);
      filter.connect(gain);
      sources.push(noise);
      nodes.push(filter);
    }
    let remaining = sources.length;
    for (const source of sources) {
      if (audio === ctx) activeSources.add(source);
      source.onended = () => {
        source.disconnect();
        activeSources.delete(source);
        if (--remaining === 0) nodes.forEach((node) => node.disconnect());
      };
      source.start(when);
      source.stop(when + duration + 0.03);
    }
    return duration;
  }
  function beat(step) {
    for (const b of grid.querySelectorAll("[data-step],[data-column]"))
      b.classList.toggle(
        "is-beat",
        Number(b.dataset.step ?? b.dataset.column) === step,
      );
    $("scoreReadout").textContent = String(step + 1).padStart(2, "0") + " / 08";
    playedSteps++;
  }
  function scheduler() {
    if (!playing || document.hidden) return;
    while (nextTime < ctx.currentTime + 0.12) {
      const step = nextStep,
        when = nextTime;
      for (let row = 0; row < 4; row++)
        if (C.active(score, row, step)) voice(ctx, master, row, when);
      const timer = setTimeout(
        () => {
          visualTimers.delete(timer);
          if (playing) beat(step);
        },
        Math.max(0, (when - ctx.currentTime) * 1000),
      );
      visualTimers.add(timer);
      nextStep = (nextStep + 1) % 8;
      nextTime += 60 / score.tempo;
    }
  }
  function stop(message) {
    epoch++;
    playing = false;
    clearInterval(interval);
    interval = null;
    for (const timer of visualTimers) clearTimeout(timer);
    visualTimers.clear();
    for (const source of activeSources) {
      try {
        source.stop();
      } catch {}
    }
    activeSources.clear();
    if (master) master.gain.value = 0;
    for (const b of grid.querySelectorAll(".is-beat"))
      b.classList.remove("is-beat");
    $("scorePlay").setAttribute("aria-pressed", "false");
    $("scorePlay").replaceChildren(
      Object.assign(document.createElement("span"), { textContent: "▶" }),
      document.createTextNode(" 听见这段课间"),
    );
    if (message) $("audioStatus").textContent = message;
  }
  function audioError() {
    stop("这台浏览器暂时不能播放合成音频。仍可编辑、分享和导出明信片。");
  }
  $("scorePlay").onclick = async () => {
    if (playing) {
      stop("已停止。留白也是作品的一部分。");
      return;
    }
    const token = ++epoch;
    try {
      await unlock();
      if (token !== epoch || document.hidden) return;
      window.HaizExperience?.setSound(false);
      playing = true;
      master.gain.value = volume;
      nextStep = 0;
      nextTime = ctx.currentTime + 0.06;
      $("scorePlay").setAttribute("aria-pressed", "true");
      $("scorePlay").replaceChildren(
        Object.assign(document.createElement("span"), { textContent: "Ⅱ" }),
        document.createTextNode(" 停止这段课间"),
      );
      $("audioStatus").textContent =
        "正在播放你的八拍循环 · 合成声景，非现场录音。";
      scheduler();
      interval = setInterval(scheduler, 25);
    } catch {
      audioError();
    }
  };
  $("scoreTempo").oninput = (e) => {
    score.tempo = Number(e.target.value);
    saveEnabled = true;
    render();
  };
  $("scoreVolume").oninput = (e) => {
    volume = Number(e.target.value) / 100;
    $("volumeValue").textContent = e.target.value + "%";
    if (master && ctx)
      master.gain.setTargetAtTime(volume, ctx.currentTime, 0.03);
  };
  for (const button of document.querySelectorAll("[data-score]"))
    button.onclick = () => {
      stop("换好了一段新灵感。按播放，从第一拍开始。");
      const preset = C.preset(button.dataset.score);
      score.masks = preset.masks;
      score.tempo = preset.tempo;
      saveEnabled = true;
      render();
    };
  $("roomNote").oninput = (e) => {
    score.note = C.text(e.target.value);
    saveEnabled = true;
    render();
  };
  for (const b of document.querySelectorAll("button[data-paper]"))
    b.onclick = () => {
      score.paper = b.dataset.paper;
      saveEnabled = true;
      render();
    };
  $("shareScore").onclick = async () => {
    const url = shareURL();
    $("scoreLink").value = url;
    try {
      if (!navigator.clipboard?.writeText) throw Error("clipboard unavailable");
      await navigator.clipboard.writeText(url);
      $("mailStatus").textContent =
        "接力链接已复制。另一台手机或电脑打开即可继续改编；不是实时联机。";
    } catch {
      $("scoreLink").focus();
      $("scoreLink").select();
      $("mailStatus").textContent =
        "作品链接已选中，请手动复制。拿到链接的人能读到留言。";
    }
  };
  function download(blob, name) {
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  function loadPhoto(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
  }
  function wrapText(c, text, x, y, width, line) {
    let row = "",
      offset = 0;
    for (const char of Array.from(text)) {
      if (char === "\n") {
        c.fillText(row, x, y + offset);
        offset += line;
        row = "";
        continue;
      }
      if (c.measureText(row + char).width > width) {
        c.fillText(row, x, y + offset);
        offset += line;
        row = char;
      } else row += char;
    }
    if (row) c.fillText(row, x, y + offset);
  }
  $("exportPostcard").onclick = async () => {
    const button = $("exportPostcard");
    button.disabled = true;
    const snapshot = C.clean(score),
      p = C.places.find((p) => p.id === snapshot.place);
    try {
      await document.fonts?.ready;
      const image = await loadPhoto(p.image),
        out = document.createElement("canvas");
      out.width = 1080;
      out.height = 1440;
      const c = out.getContext("2d"),
        ink = snapshot.paper === "clay" ? "#733f30" : "#193b35";
      c.fillStyle = snapshot.paper === "clay" ? "#efdac9" : "#e5e9d8";
      c.fillRect(0, 0, 1080, 1440);
      c.fillStyle = ink;
      c.font = "18px RoomSora, sans-serif";
      c.fillText("HAIZ.SPACE / A POSTCARD THAT CAN BE HEARD", 64, 79);
      c.font = "34px serif";
      c.fillText("共 感 暗 房", 790, 80);
      c.fillStyle = "#142821";
      c.fillRect(64, 135, 952, 675);
      const scale = Math.min(952 / image.width, 675 / image.height),
        w = image.width * scale,
        h = image.height * scale;
      c.drawImage(image, 64 + (952 - w) / 2, 135 + (675 - h) / 2, w, h);
      c.fillStyle = ink;
      c.font = '36px "Songti SC", "STSong", serif';
      wrapText(c, snapshot.note || defaultNote, 64, 885, 952, 57);
      for (let row = 0; row < 4; row++)
        for (let step = 0; step < 8; step++) {
          c.globalAlpha = C.active(snapshot, row, step) ? 0.9 : 0.13;
          c.fillRect(64 + step * 56, 1120 + row * 18, 45, 7);
        }
      c.globalAlpha = 1;
      c.font = "19px RoomSora, sans-serif";
      c.fillText(p.name + " / " + snapshot.tempo + " BPM", 64, 1250);
      c.textAlign = "right";
      c.fillText("NO. " + C.code(snapshot), 1016, 1250);
      c.textAlign = "left";
      c.strokeStyle = ink;
      c.globalAlpha = 0.25;
      c.beginPath();
      c.moveTo(64, 1285);
      c.lineTo(1016, 1285);
      c.stroke();
      c.globalAlpha = 1;
      c.font = "16px sans-serif";
      c.fillText(
        "照片：项目既有校园影像，版权归原作者与发布机构；年代与转载授权待核。",
        64,
        1326,
      );
      c.fillText(
        "声景：浏览器合成创作，非现场录音。非官方校园实验 / 非实时联机。",
        64,
        1360,
      );
      const blob = await new Promise((resolve) =>
        out.toBlob(resolve, "image/png"),
      );
      if (!blob) throw Error("PNG unavailable");
      download(blob, "haiz-postcard-" + C.code(snapshot) + ".png");
      $("mailStatus").textContent =
        "PNG 已生成，保留完整照片画幅与来源说明。手机若未直接下载，请查看浏览器下载列表。";
    } catch {
      $("mailStatus").textContent =
        "图片暂未生成。请确认照片已载入，或先复制作品链接保存创作。";
    } finally {
      button.disabled = false;
    }
  };
  function wav(buffer) {
    const samples = buffer.getChannelData(0),
      bytes = new ArrayBuffer(44 + samples.length * 2),
      v = new DataView(bytes);
    const word = (offset, text) => {
      for (let i = 0; i < text.length; i++)
        v.setUint8(offset + i, text.charCodeAt(i));
    };
    word(0, "RIFF");
    v.setUint32(4, 36 + samples.length * 2, true);
    word(8, "WAVE");
    word(12, "fmt ");
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);
    v.setUint16(22, 1, true);
    v.setUint32(24, buffer.sampleRate, true);
    v.setUint32(28, buffer.sampleRate * 2, true);
    v.setUint16(32, 2, true);
    v.setUint16(34, 16, true);
    word(36, "data");
    v.setUint32(40, samples.length * 2, true);
    for (let i = 0; i < samples.length; i++) {
      const n = Math.max(-1, Math.min(1, samples[i]));
      v.setInt16(44 + i * 2, n < 0 ? n * 32768 : n * 32767, true);
    }
    return new Blob([bytes], { type: "audio/wav" });
  }
  $("exportScore").onclick = async () => {
    const button = $("exportScore");
    button.disabled = true;
    const snapshot = C.clean(score);
    try {
      const Offline =
        window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!Offline) throw Error("Offline audio unavailable");
      const duration = C.duration(snapshot) + 1.3,
        audio = new Offline(1, Math.ceil(44100 * duration), 44100),
        gain = audio.createGain();
      gain.gain.value = volume;
      gain.connect(audio.destination);
      for (let step = 0; step < 8; step++)
        for (let row = 0; row < 4; row++)
          if (C.active(snapshot, row, step))
            voice(audio, gain, row, 0.04 + (step * 60) / snapshot.tempo);
      const buffer = await audio.startRendering();
      download(wav(buffer), "haiz-score-" + C.code(snapshot) + ".wav");
      $("mailStatus").textContent = snapshot.masks.every((n) => n === 0)
        ? "已导出一轮安静的 WAV。你选择的留白也被保留。"
        : "已导出一轮八拍 WAV，包含尾音。它是你的合成编排，不是现场录音。";
    } catch {
      $("mailStatus").textContent =
        "此浏览器暂不支持离线声音导出。仍可复制链接，在另一台设备播放。";
    } finally {
      button.disabled = false;
    }
  };
  $("forgetScore").onclick = () => {
    stop("已清除本机创作。");
    try {
      localStorage.removeItem(key);
    } catch {}
    saveEnabled = false;
    score = C.preset("shade");
    shared = false;
    try {
      history.replaceState(null, "", location.pathname + location.search);
    } catch {}
    resetReveal();
    render(true);
    $("mailStatus").textContent =
      "本机这份创作已清除。不会撤回已分享链接；下一次编辑会保存一份新创作。";
  };
  addEventListener("hashchange", () => {
    if (!location.hash.startsWith("#score=")) return;
    stop("接到新作品。按播放，听见它。");
    incoming();
    if (badHash) {
      $("mailStatus").textContent =
        "这份作品链接不完整或格式不支持。没有覆盖当前创作。";
      return;
    }
    resetReveal();
    saveEnabled = true;
    render(true);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop("页面已离开，声景自动停止。回来后可手动继续。");
  });
  addEventListener("pagehide", () => {
    stop();
    ctx?.suspend().catch(() => {});
  });
  document.addEventListener("click", (e) => {
    if (e.target.closest("#soundDesk,#bellButton"))
      stop("已停止编曲，切换到全站声音工具。");
  });
  addEventListener("storage", (e) => {
    if (e.key === key && e.newValue === null) {
      stop("本机创作已在另一页面清除。");
      saveEnabled = false;
      score = C.preset("shade");
      shared = false;
      render(true);
    }
  });
  render(true, false);
  resizeMask();
  applyExposure();
  if (badHash)
    $("mailStatus").textContent =
      "作品链接不完整或格式不支持；已保留本机创作，可重新开始。";
  else if (saveFailed)
    $("mailStatus").textContent =
      "本地存储不可用或记录损坏，当前创作仍可播放、导出或分享。";
  window.HaizDarkroom = {
    get score() {
      return C.clean(score);
    },
    get diagnostics() {
      return {
        playing,
        audioState: ctx?.state || "not-created",
        sources: activeSources.size,
        playedSteps,
        strokes: points.length,
        shared,
        saveEnabled,
      };
    },
    stop,
  };
})();
