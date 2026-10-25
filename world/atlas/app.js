/* HAIZ ATLAS — original, dependency-free UI concept. No generated content or account data. */
(function () {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const store = {
    read(key, fallback) {
      try { const raw = localStorage.getItem(key); return raw == null ? fallback : JSON.parse(raw); }
      catch (_) { return fallback; }
    },
    write(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); return true; }
      catch (_) { return false; }
    }
  };
  const THEME_KEY = "haiz-atlas-theme-v1";
  const TASK_KEY = "haiz-atlas-tasks-v1";
  const allowedThemes = ["porcelain", "obsidian", "ocean"];
  const scenes = {
    home: {
      heading: "在这里，<br><em>生活有了坐标。</em>",
      intro: "课程之外，仍有许多值得走近的地方。<br>从今天出发，发现熟悉校园的另一面。",
      photos: [
        ["../../assets/images/campus/campus_fengqitang.jpg", "01 · 建筑 / ARCHITECTURE", "阳光走过凤栖堂。", "从砖墙的温度，重新认识这所学校。", "../campus.html", "进入校园"],
        ["../../assets/images/campus/campus_yanchi.jpg", "02 · 风景 / THE POND", "风停在砚池边。", "看见那些平日匆匆路过的细节。", "../../architecture.html", "阅读建筑"],
        ["../../assets/images/campus/campus_library.jpg", "03 · 日常 / THE LIBRARY", "有人在光里翻书。", "没有喧哗的地方，也有属于它的故事。", "../stillroom/", "开始专注"]
      ]
    },
    campus: {
      heading: "一所学校，<br><em>许多条抵达的路。</em>",
      intro: "从地图走进场景，从建筑走进记忆。<br>这里是一段创作中的数字校园。",
      photos: [
        ["../../assets/images/campus/aerial_campus.jpg", "01 · 地图 / THE ATLAS", "在空中，重新认识校园。", "从另一个视角，观察熟悉的路径。", "../campus.html", "探索地图"],
        ["../../assets/images/campus/campus_fucheng_gate.jpg", "02 · 起点 / THE GATE", "每一次进入，都是开始。", "熟悉的校门，通往新的故事。", "../../campus-3d.html", "进入三维校园"],
        ["../../assets/images/campus/campus_yanlintang.jpg", "03 · 建筑 / FIELD NOTES", "建筑记得走过的人。", "沿着屋檐与长廊，慢慢走一趟。", "../../architecture.html", "阅读观察"]
      ]
    },
    study: {
      heading: "把喧闹留在门外，<br><em>留一束光给自己。</em>",
      intro: "不是为了追赶每一分钟。<br>只是给想做的事情，留一个安静的地方。",
      photos: [
        ["../../assets/images/campus/campus_library.jpg", "01 · 专注 / STILLROOM", "时间慢一点，也没关系。", "一张桌子，一点雨声，从这里开始。", "../stillroom/", "进入 STILLROOM"],
        ["../../assets/images/campus/campus_yihao.jpg", "02 · 空间 / INNER WORLD", "教室，终于可以走进去。", "空间、光照与桌椅构成可行走的原创概念场景。", "../room/immersive/", "步入概念教室"],
        ["../../assets/images/campus/campus_taoranting.jpg", "03 · 停留 / WINDOWSILL", "课间，也值得被珍藏。", "给文字、声音和短暂停留一个位置。", "../../windowsill/index.html", "打开课间窗台"]
      ]
    },
    community: {
      heading: "一所学校的温度，<br><em>来自那些相遇。</em>",
      intro: "社团、刊物与树荫下的闲谈。<br>除了教室，还有许多值得记录的日常。",
      photos: [
        ["../../assets/images/campus/campus_taoranting.jpg", "01 · 相遇 / CAMPUS LIFE", "好故事，从不只在课堂。", "在校园里发现新的生活提案。", "../../clubs.html", "看看社团"],
        ["../../assets/images/campus/campus_nanmen.jpg", "02 · 文字 / JOURNAL", "把日常，认真地写下来。", "学校的风景，也是青春的注脚。", "../../journal.html", "翻阅校园杂志"],
        ["../../assets/images/campus/scenery_01.jpg", "03 · 记忆 / FIELD NOTES", "这些安静的瞬间。", "走过的路与遇见的人，值得被记住。", "../../memory-walk.html", "阅读校园记忆"]
      ]
    }
  };
  let activeView = "home";
  let photoIndex = 0;
  let tasks = store.read(TASK_KEY, []);
  if (!Array.isArray(tasks)) tasks = [];
  tasks = tasks.filter(item => item && typeof item.text === "string" && item.text.length <= 80 && typeof item.id === "string").slice(0, 15);
  const status = $("#status");
  function announce(message) { status.textContent = message; }
  function sceneRender() {
    const config = scenes[activeView];
    const record = config.photos[photoIndex];
    $("#editionTitle").innerHTML = config.heading;
    $("#editionDescription").innerHTML = config.intro;
    $("#sceneKicker").textContent = record[1];
    $("#sceneTitle").textContent = record[2];
    $("#sceneBody").textContent = record[3];
    $("#sceneLink").href = record[4];
    $("#sceneLink").firstChild.textContent = record[5] + " ";
    $("#sceneCount").textContent = String(photoIndex + 1).padStart(2, "0");
    $("#sceneVisual").style.setProperty("--scene-image", "url('" + record[0] + "')");
    document.body.classList.remove("view-switching");
    // Restart finite entrance without an animation loop.
    void document.body.offsetWidth;
    document.body.classList.add("view-switching");
    announce("已切换到" + record[2]);
  }
  function dockLens() {
    const dock = $(".float-dock");
    const active = $(".dock-item.is-active", dock);
    const lens = $("#dockLens");
    if (!dock || !active || !lens) return;
    const x = active.getBoundingClientRect().left - dock.getBoundingClientRect().left - 7;
    lens.style.setProperty("--lens-x", Math.round(x) + "px");
    lens.style.width = active.getBoundingClientRect().width + "px";
  }
  function selectView(view) {
    if (!Object.hasOwn(scenes, view)) return;
    activeView = view;
    photoIndex = 0;
    $$("[data-view]").forEach(button => {
      const selected = button.dataset.view === view;
      button.classList.toggle("is-active", selected);
      if (selected) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    sceneRender();
    dockLens();
    // Keep history meaningful without interfering with the existing HAIZ WORLD routes.
    if (history.replaceState) history.replaceState(null, "", "#" + view);
  }
  $$("[data-view]").forEach(button => button.addEventListener("click", () => {
    selectView(button.dataset.view);
    if (window.innerWidth <= 650) window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }));
  $("#scenePrev").addEventListener("click", () => { photoIndex = (photoIndex + 2) % 3; sceneRender(); });
  $("#sceneNext").addEventListener("click", () => { photoIndex = (photoIndex + 1) % 3; sceneRender(); });
  function setTheme(next) {
    const theme = allowedThemes.includes(next) ? next : "porcelain";
    document.documentElement.dataset.theme = theme;
    $("#themeSelect").value = theme;
    store.write(THEME_KEY, theme);
    announce("已切换到 " + theme + " 主题");
  }
  $("#themeSelect").addEventListener("change", event => setTheme(event.target.value));
  setTheme(store.read(THEME_KEY, "porcelain"));
  function saveTasks() {
    if (!store.write(TASK_KEY, tasks)) announce("本地存储不可用。此页刷新后可能无法保留清单。");
  }
  function renderTasks() {
    const list = $("#taskList");
    list.replaceChildren();
    for (const task of tasks) {
      const li = document.createElement("li");
      if (task.done) li.classList.add("done");
      const check = document.createElement("input");
      check.type = "checkbox";
      check.checked = Boolean(task.done);
      check.setAttribute("aria-label", "完成：" + task.text);
      check.addEventListener("change", () => { task.done = check.checked; saveTasks(); renderTasks(); });
      const label = document.createElement("span");
      label.textContent = task.text; // Never render user content as HTML.
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "×";
      remove.setAttribute("aria-label", "删除：" + task.text);
      remove.addEventListener("click", () => { tasks = tasks.filter(value => value.id !== task.id); saveTasks(); renderTasks(); });
      li.append(check, label, remove);
      list.appendChild(li);
    }
    const done = tasks.filter(item => item.done).length;
    $("#taskSummary").textContent = tasks.length ? "本机记录 " + tasks.length + " 项 · 完成 " + done + " 项" : "尚无记录 · 只保存在本机";
  }
  $("#taskForm").addEventListener("submit", event => {
    event.preventDefault();
    const input = $("#taskInput");
    const value = input.value.trim();
    if (!value) return;
    if (tasks.length >= 15) { announce("最多保留 15 项。可以先删除一些旧记录。"); return; }
    tasks.unshift({ id: String(Date.now()) + "-" + Math.random().toString(36).slice(2), text: value.slice(0, 80), done: false });
    saveTasks();
    renderTasks();
    input.value = "";
    announce("已添加一件小事");
  });
  $("#clearDone").addEventListener("click", () => {
    tasks = tasks.filter(item => !item.done);
    saveTasks();
    renderTasks();
    announce("已清理完成的记录");
  });
  renderTasks();
  const routes = [
    { name:"HAIZ WORLD", group:"数字校园", url:"../index.html", icon:"◈", keys:"home 主页 入口" },
    { name:"HAIZ ATLAS", group:"校园视野", url:"../campus.html", icon:"⌖", keys:"校园 地图 走路 3d" },
    { name:"STILLROOM", group:"沉浸自习", url:"../stillroom/", icon:"◷", keys:"专注 学习 自习 计时" },
    { name:"INNER WORLD", group:"三维教室", url:"../room/immersive/", icon:"◫", keys:"概念 教室 光影" },
    { name:"校园杂志", group:"阅读", url:"../../journal.html", icon:"✎", keys:"文章 学校" },
    { name:"社团生活", group:"校园生活", url:"../../clubs.html", icon:"✳", keys:"社团 活动" },
    { name:"建筑观察", group:"现场笔记", url:"../../architecture.html", icon:"⌑", keys:"建筑 风景 照片" },
    { name:"课间窗台", group:"沉浸体验", url:"../../windowsill/index.html", icon:"◌", keys:"课间 留言 便笺" },
    { name:"Flow 工作台", group:"需要服务端授权", url:"../flow/", icon:"↗", keys:"教师 协作 作业 授权" }
  ];
  const command = $("#commandDialog");
  const commandInput = $("#commandInput");
  let matches = routes;
  let resultIndex = 0;
  function renderResults() {
    const q = commandInput.value.trim().toLocaleLowerCase();
    matches = routes.filter(row => (row.name + " " + row.group + " " + row.keys).toLocaleLowerCase().includes(q));
    matches = matches.slice(0, 9);
    if (resultIndex >= matches.length) resultIndex = 0;
    const list = $("#commandResults");
    list.replaceChildren();
    for (const [index, record] of matches.entries()) {
      const li = document.createElement("li");
      if (index === resultIndex) li.classList.add("is-selected");
      const link = document.createElement("a");
      link.href = record.url;
      const icon = document.createElement("span"); icon.textContent = record.icon;
      const name = document.createElement("strong"); name.textContent = record.name;
      const group = document.createElement("small"); group.textContent = record.group;
      link.append(icon, name, group);
      link.addEventListener("mouseenter", () => { resultIndex = index; $$(".command-results li").forEach((el, i) => el.classList.toggle("is-selected", i === index)); });
      li.appendChild(link); list.appendChild(li);
    }
    if (!matches.length) {
      const li = document.createElement("li");
      li.textContent = "没有匹配结果，试试“校园”或“专注”";
      li.style.padding = "16px";
      list.appendChild(li);
    }
  }
  function openCommand() {
    if (!command.open) command.showModal();
    commandInput.value = "";
    resultIndex = 0;
    renderResults();
    commandInput.focus();
  }
  $("#openSearch").addEventListener("click", openCommand);
  commandInput.addEventListener("input", () => { resultIndex = 0; renderResults(); });
  commandInput.addEventListener("keydown", event => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (matches.length) resultIndex = (resultIndex + matches.length + (event.key === "ArrowDown" ? 1 : -1)) % matches.length;
      renderResults();
    }
    if (event.key === "Enter" && matches[resultIndex]) {
      event.preventDefault();
      window.location.assign(matches[resultIndex].url);
    }
  });
  window.addEventListener("keydown", event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); if (command.open) command.close(); else openCommand(); }
  });
  window.addEventListener("resize", dockLens, { passive:true });
  const date = new Intl.DateTimeFormat("zh-CN",{month:"long",day:"numeric",weekday:"long"}).format(new Date());
  $("#todayDate").textContent = date;
  const initialView = location.hash.replace("#","");
  selectView(Object.hasOwn(scenes, initialView) ? initialView : "home");
})();