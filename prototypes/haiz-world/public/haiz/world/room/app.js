/* SPDX-License-Identifier: AGPL-3.0-only — haiz campus adaptation, 2026.
 * Self-contained AGPL application; no API, upload, account or parent-site script.
 */
(() => {
  "use strict";
  const C = window.DeskCore,
    $ = (id) => document.getElementById(id),
    reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;
  let storage;
  try {
    storage = localStorage;
  } catch {
    storage = {
      getItem() {
        return null;
      },
      setItem() {
        throw Error("Storage disabled");
      },
      removeItem() {},
    };
  }
  let state = C.read(storage),
    selected = "notes",
    frame = null,
    ready = false,
    preset = "morning",
    loadTimer = 0,
    saveTimer = 0,
    dirty = false,
    chapter = 0,
    promptIndex = 0;
  const timer = C.timer(),
    channel = "haiz:windowsill:v1";
  let timerInterval = 0,
    completionShown = false;
  const toolObjects = {
    notes: "notes",
    focus: "cal",
    letter: "letter",
    audio: "music",
    book: "book",
    jar: "jar",
  };
  const objectTools = {
    notes: "notes",
    cal: "focus",
    mug: "focus",
    letter: "letter",
    music: "audio",
    book: "book",
    jar: "jar",
    space: "notes",
  };
  const objectLinks = {
    phone: "../life.html",
    toys: "../darkroom.html",
    trips: "../director.html",
    where: "../campus-3d.html",
    maple: "source.html",
  };
  function send(type, payload = {}) {
    if (frame && ready)
      frame.contentWindow.postMessage(
        { channel, type, ...payload },
        location.origin,
      );
  }
  function announce(text) {
    $("deskStatus").textContent = text;
  }
  function persist() {
    dirty = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const ok = C.write(storage, state);
      dirty = !ok;
      $("saveState").textContent = ok
        ? "已保存在当前浏览器；不会上传。"
        : "浏览器未允许保存；当前页面仍可编辑，关闭前请下载信件。";
    }, 220);
  }
  function syncState() {
    state = C.clean(state);
    state.notes.forEach((n, i) => {
      $("note" + i).value = n;
    });
    $("futureLetter").value = state.letter;
    $("letterCount").textContent =
      Array.from(state.letter).length + " / 600 字";
    send("notes", { value: state.notes });
  }
  function selectTool(id, { focusScene = true, moveFocus = false } = {}) {
    if (!Object.hasOwn(toolObjects, id)) return;
    selected = id;
    document
      .querySelectorAll("[data-tool]")
      .forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.tool === id)),
      );
    document.querySelectorAll("[data-panel]").forEach((p) => {
      p.hidden = p.dataset.panel !== id;
    });
    if (focusScene) send("focus", { key: toolObjects[id] });
    if (moveFocus) {
      const heading = document.querySelector('[data-panel="' + id + '"] h3');
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
      heading.scrollIntoView({
        block: "nearest",
        behavior: reduce ? "instant" : "smooth",
      });
    }
  }
  document
    .querySelectorAll("[data-tool]")
    .forEach((b) => (b.onclick = () => selectTool(b.dataset.tool)));
  state.notes.forEach((n, i) => {
    $("note" + i).addEventListener("input", () => {
      const el = $("note" + i);
      state.notes[i] = C.cut(el.value, 40);
      if (el.value !== state.notes[i]) el.value = state.notes[i];
      send("notes", { value: state.notes });
      persist();
    });
  });
  $("futureLetter").oninput = () => {
    state.letter = C.cut($("futureLetter").value, 600);
    if ($("futureLetter").value !== state.letter)
      $("futureLetter").value = state.letter;
    $("letterCount").textContent =
      Array.from(state.letter).length + " / 600 字";
    persist();
  };
  $("clearLetter").onclick = () => {
    state.letter = "";
    syncState();
    persist();
    announce("这封本机信件已清空。");
  };
  function download(blob, name) {
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  $("downloadLetter").onclick = () => {
    if (!state.letter.trim()) {
      announce("先写下一句话，再把信带走。");
      return;
    }
    download(
      new Blob(
        [
          "课间窗台 · 给未来的自己\n" +
            new Date().toLocaleDateString("zh-CN") +
            "\n\n" +
            state.letter +
            "\n\n仅由你写下并下载；未上传至服务器。\n",
        ],
        { type: "text/plain;charset=utf-8" },
      ),
      "haiz-给未来的信.txt",
    );
    announce("信件已准备下载；网站没有寄出或上传它。");
  };
  function renderTimer() {
    const s = timer.tick();
    $("timerReadout").value = s.label;
    $("timerReadout").textContent = s.label;
    $("timerToggle").textContent = s.running
      ? "暂停片刻"
      : s.complete
        ? "再留一小段"
        : "开始这一小段";
    if (s.complete && !completionShown) {
      completionShown = true;
      $("timerStatus").textContent = "这一小段已经结束。抬头看看窗外吧。";
    }
    if (!s.running) stopTimerLoop();
  }
  function stopTimerLoop() {
    clearInterval(timerInterval);
    timerInterval = 0;
  }
  function startTimerLoop() {
    stopTimerLoop();
    if (!document.hidden && timer.snapshot.running)
      timerInterval = setInterval(renderTimer, 250);
  }
  document.querySelectorAll("[data-minutes]").forEach(
    (b) =>
      (b.onclick = () => {
        timer.choose(Number(b.dataset.minutes));
        completionShown = false;
        document
          .querySelectorAll("[data-minutes]")
          .forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        $("timerStatus").textContent =
          b.dataset.minutes === "2"
            ? "给眼睛和肩膀留一点空白。"
            : "准备好了，再由你开始。";
        renderTimer();
      }),
  );
  $("timerToggle").onclick = () => {
    if (timer.snapshot.running) {
      timer.pause();
      $("timerStatus").textContent = "已暂停，剩下的时间留给你。";
    } else {
      completionShown = false;
      timer.start();
      $("timerStatus").textContent =
        "正在计时。后台按实际时间继续，刷新页面则重新开始。";
      startTimerLoop();
    }
    renderTimer();
  };
  $("timerReset").onclick = () => {
    timer.reset();
    completionShown = false;
    $("timerStatus").textContent = "这一小段回到了起点。";
    renderTimer();
  };
  function renderBook() {
    const book = C.books[chapter];
    $("bookLeft").textContent = book.left;
    $("bookRight").textContent = book.right;
    send("book", { left: book.left, right: book.right });
  }
  $("bookChapter").onchange = () => {
    chapter = Math.min(2, Math.max(0, Number($("bookChapter").value) || 0));
    renderBook();
  };
  function renderPrompt() {
    $("promptText").textContent = C.prompts[promptIndex];
  }
  $("newPrompt").onclick = () => {
    promptIndex =
      (promptIndex + 1 + Math.floor(Math.random() * (C.prompts.length - 1))) %
      C.prompts.length;
    renderPrompt();
  };

  // 3D is opt-in. The entire scene/module/model tree stays unloaded until a gesture.
  $("sceneQuality").value = matchMedia("(pointer:coarse)").matches
    ? "low"
    : "balanced";
  function unloadScene(message = "已收起 3D，纸面工具与本机内容仍可使用。") {
    clearTimeout(loadTimer);
    send("sound", { value: false });
    send("suspend", { value: true });
    frame?.remove();
    frame = null;
    ready = false;
    $("scenePoster").hidden = false;
    $("startScene").disabled = false;
    $("startScene").textContent = "推开这扇窗 ↗";
    $("unloadScene").hidden = true;
    $("sceneStatus").textContent = message;
  }
  $("startScene").onclick = () => {
    if (frame) return;
    $("startScene").disabled = true;
    $("startScene").textContent = "正在整理窗边的光…";
    $("sceneStatus").textContent =
      "正在本地加载场景、材质与四件精修家具。初次加载可能需要片刻。";
    frame = document.createElement("iframe");
    frame.title = "课间窗台三维场景，方向键或拖动查看，Escape 返回总览";
    frame.src = "scene/index.html?quality=" + $("sceneQuality").value;
    $("sceneSlot").append(frame);
    $("unloadScene").hidden = false;
    loadTimer = setTimeout(() => {
      if (!ready)
        $("sceneStatus").textContent =
          "此设备加载较慢。可以收起 3D，所有纸面工具仍可用。";
    }, 45000);
  };
  $("unloadScene").onclick = () => unloadScene();
  $("sceneQuality").onchange = () =>
    send("quality", { value: $("sceneQuality").value });
  document.querySelectorAll("[data-preset]").forEach(
    (b) =>
      (b.onclick = () => {
        preset = b.dataset.preset;
        document
          .querySelectorAll("[data-preset]")
          .forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        send("preset", { id: preset });
        if (!ready)
          $("sceneStatus").textContent =
            "已选择" + b.textContent.slice(3) + "；推开窗后应用这束光。";
      }),
  );
  addEventListener("message", (event) => {
    if (
      !frame ||
      event.origin !== location.origin ||
      event.source !== frame.contentWindow ||
      event.data?.channel !== channel
    )
      return;
    const d = event.data;
    if (d.type === "ready") {
      ready = true;
      clearTimeout(loadTimer);
      $("scenePoster").hidden = true;
      $("sceneStatus").textContent = reduce
        ? "静态模式已开启；物件仍可点选，纸面功能完整可用。"
        : "场景已就绪。拖动看景，点选物件；下方可随时收起 3D。";
      send("quality", { value: $("sceneQuality").value });
      send("preset", { id: preset });
      send("notes", { value: state.notes });
      renderBook();
      send("suspend", { value: document.hidden });
    }
    if (d.type === "error") {
      unloadScene(
        "当前设备未能运行 3D。便签、时钟、书信与本机留声仍正常可用。",
      );
    }
    if (
      d.type === "focus" &&
      typeof d.key === "string" &&
      Object.hasOwn(objectTools, d.key)
    )
      selectTool(objectTools[d.key], { focusScene: false });
    if (d.type === "action" && typeof d.key === "string") {
      if (Object.hasOwn(objectTools, d.key))
        selectTool(objectTools[d.key], { focusScene: false, moveFocus: true });
      else if (Object.hasOwn(objectLinks, d.key))
        location.href = objectLinks[d.key];
    }
  });

  // Real local audio only: bounded file, metadata validation, memory-only Blob URLs.
  let audioURL = "",
    audioData = null,
    audioGeneration = 0,
    metadataAudio = null,
    metadataTimer = 0,
    metadataCancel = null;
  VoiceNote.config({
    title: "课间留声",
    shape: "sprout",
    sub: () => "本机声音 · 文字由你填写，非自动转写",
    audio: (d) => d.audio_url,
    menu: [],
  });
  function clearAudio(message = "声音已移除，本机文件没有被上传。") {
    audioGeneration++;
    clearTimeout(metadataTimer);
    metadataCancel?.();
    metadataCancel = null;
    if (metadataAudio) {
      metadataAudio.pause();
      metadataAudio.removeAttribute("src");
      metadataAudio.load();
      metadataAudio = null;
    }
    VoiceNote.stop();
    if (audioData) VoiceNote.forget(audioData.id);
    audioData = null;
    if (audioURL) URL.revokeObjectURL(audioURL);
    audioURL = "";
    $("voiceSlot").replaceChildren();
    $("audioFile").value = "";
    $("audioVisual").disabled = $("audioClear").disabled = true;
    $("audioStatus").textContent = message;
  }
  function renderVoice() {
    if (!audioData) return;
    VoiceNote.stop();
    VoiceNote.forget(audioData.id);
    audioData = {
      ...audioData,
      en: C.cut($("audioCaption").value, 240) || "本机声音 · 没有填写说明。",
    };
    VoiceNote.config({ shape: $("audioShape").value });
    $("voiceSlot").replaceChildren(VoiceNote.render(audioData));
  }
  $("audioFile").onchange = async () => {
    const file = $("audioFile").files[0];
    clearAudio("正在检查本机声音…");
    if (!file) {
      $("audioStatus").textContent = "请选择本机声音。";
      return;
    }
    if (file.size > 20 * 1024 * 1024 || !file.size) {
      $("audioStatus").textContent =
        "请选择大于 0 且不超过 20 MiB 的音频文件。";
      return;
    }
    if (
      file.type &&
      !file.type.startsWith("audio/") &&
      !/\.(wav|mp3|m4a|ogg|flac|webm)$/i.test(file.name)
    ) {
      $("audioStatus").textContent = "这不是支持的音频文件。";
      return;
    }
    const generation = audioGeneration;
    audioURL = URL.createObjectURL(file);
    const url = audioURL;
    try {
      const duration = await new Promise((resolve, reject) => {
        const audio = (metadataAudio = new Audio());
        audio.preload = "metadata";
        let settled = false;
        const finish = (error, value) => {
          if (settled) return;
          settled = true;
          clearTimeout(metadataTimer);
          metadataCancel = null;
          audio.onloadedmetadata = audio.onerror = null;
          error ? reject(error) : resolve(value);
        };
        metadataCancel = () => finish(Error("cancelled"));
        audio.onloadedmetadata = () => finish(null, audio.duration);
        audio.onerror = () => finish(Error("此浏览器不能解码这个音频。"));
        metadataTimer = setTimeout(
          () => finish(Error("音频读取超时，请换一个较小的文件。")),
          12000,
        );
        audio.src = url;
      });
      if (generation !== audioGeneration) return;
      metadataAudio?.removeAttribute("src");
      metadataAudio?.load();
      metadataAudio = null;
      if (!Number.isFinite(duration) || duration <= 0 || duration > 180)
        throw Error("请使用时长不超过 3 分钟的声音。");
      audioData = {
        id: "haiz-local-" + generation,
        audio_url: url,
        duration,
        en: "",
      };
      renderVoice();
      $("audioVisual").disabled = $("audioClear").disabled = false;
      $("audioStatus").textContent =
        file.name +
        " · " +
        C.format(duration * 1000) +
        " · 点击波形播放，打开声音画布查看真实响度。文字仅按进度展示，不是逐字识别。";
    } catch (error) {
      if (generation !== audioGeneration) return;
      clearAudio(error.message);
    }
  };
  $("audioCaption").onchange = renderVoice;
  $("audioShape").onchange = () =>
    VoiceNote.config({ shape: $("audioShape").value });
  $("audioVisual").onclick = () => {
    if (audioData) {
      send("sound", { value: false });
      VoiceNote.config({ shape: $("audioShape").value });
      VoiceNote.demo(audioData);
    }
  };
  $("audioClear").onclick = () => clearAudio();
  document.addEventListener("haiz:voice:error", () => {
    $("audioStatus").textContent =
      "播放未能开始，请再次点击或换一个浏览器支持的文件。不会模拟播放成功。";
  });
  document.addEventListener("haiz:voice:decode-error", () => {
    $("audioStatus").textContent =
      "浏览器无法分析这个文件的响度；仍可尝试播放实际声音，不显示拟造的波形。";
  });
  $("clearDesk").onclick = () => {
    clearTimeout(saveTimer);
    dirty = false;
    try {
      storage.removeItem(C.KEY);
    } catch {}
    state = C.clean(null);
    syncState();
    clearAudio();
    timer.reset();
    renderTimer();
    announce("本机窗台便签、信与当前声音已清除，其他网站数据未改动。");
  };
  addEventListener("storage", (event) => {
    if (event.key !== C.KEY && event.key !== null) return;
    clearTimeout(saveTimer);
    dirty = false;
    state = C.read(storage);
    syncState();
    if (event.newValue === null) clearAudio();
    announce("本机窗台内容已与另一页面同步。");
  });
  document.addEventListener("visibilitychange", () => {
    send("suspend", { value: document.hidden });
    if (document.hidden) {
      VoiceNote.stop();
      stopTimerLoop();
    } else {
      renderTimer();
      startTimerLoop();
    }
  });
  addEventListener("pagehide", () => {
    clearTimeout(saveTimer);
    if (dirty) {
      dirty = !C.write(storage, state);
    }
    VoiceNote.stop();
    stopTimerLoop();
    send("suspend", { value: true });
    clearAudio();
  });
  addEventListener("pageshow", () => {
    if (!document.hidden) {
      send("suspend", { value: false });
      renderTimer();
      startTimerLoop();
    }
  });
  window.HaizDesk = {
    select: selectTool,
    get diagnostics() {
      return {
        selected,
        sceneLoaded: !!frame,
        sceneReady: ready,
        preset,
        reduced: reduce,
        timer: timer.snapshot,
        localAudio: !!audioData,
        audioPersistent: false,
        upload: false,
      };
    },
  };
  syncState();
  renderBook();
  renderPrompt();
  renderTimer();
})();
