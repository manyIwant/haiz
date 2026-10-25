import { suggestActions } from "./rules.js";
const pilot = Boolean(window.HAIZ_PILOT);
let authEpoch = 0;
let workspace = { courses: [], tasks: [] };
const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const read = (key, fallback, store) => {
  try {
    store ||=
      pilot && key.startsWith("haiz.flow.private.")
        ? sessionStorage
        : localStorage;
    return JSON.parse(store.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};
const write = (key, value, store) => {
  try {
    store ||=
      pilot && key.startsWith("haiz.flow.private.")
        ? sessionStorage
        : localStorage;
    store.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    toast("存储不可用；请先导出文字，当前更改仅在内存中。");
    return false;
  }
};
let token = read("haiz.flow.token", "", sessionStorage),
  who = read("haiz.flow.identity", null, sessionStorage),
  data = { drafts: [], notices: [], audit: [] },
  current = null,
  conflict = null,
  busy = false,
  lastSync = "",
  online = false;
let privateStorageAvailable = true;
let mode = read("haiz.flow.mode", "办公"),
  tone = read("haiz.flow.tone", "playful"),
  theme = read("haiz.flow.theme", "light");
document.body.dataset.theme = theme;
const key = () => `haiz.flow.private.${who?.name}`,
  local = () => read(key(), {}),
  saveLocal = () => {
    const rows = local();
    rows[current.id] = current;
    privateStorageAvailable = write(key(), rows);
    return privateStorageAvailable;
  },
  route = () => location.hash.slice(1) || "desk";
const dates = () => ({
  startsAt: new Date(Date.now() - 60000).toISOString(),
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
});
const fmt = (t) =>
  t ? new Date(t).toLocaleString("zh-CN", { hour12: false }) : "尚未同步";
const toLocal = (t) => {
  const d = new Date(t);
  return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
function toast(text) {
  $("#message").textContent = text;
  $("#message").style.display = "block";
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => ($("#message").style.display = "none"), 4500);
}
async function api(path, body, id = crypto.randomUUID()) {
  const requestToken = token,
    requestEpoch = authEpoch;
  const r = await fetch("/api/flow/" + path, {
    method: body ? "POST" : "GET",
    headers: {
      ...(!pilot ? { Authorization: "Bearer " + token } : {}),
      ...(body
        ? { "Content-Type": "application/json", "Idempotency-Key": id }
        : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(7000),
  });
  const value = await r.json();
  if (token !== requestToken || authEpoch !== requestEpoch)
    throw new Error("身份已切换，请重新操作");
  if (pilot && r.status === 401 && path !== "login" && who) expireSession();
  if (!r.ok)
    throw Object.assign(new Error(value.error), {
      status: r.status,
      remote: value.remote,
    });
  return value;
}
function modal(html) {
  $("#modal").innerHTML = html;
  $("#modal").showModal();
  $("#modal")
    .querySelector("[data-close]")
    ?.addEventListener("click", () => $("#modal").close());
}
function themeButton() {
  return '<button data-theme aria-label="切换浅色深色高对比主题">◐</button>';
}
function top() {
  return `<div class="topbar"><div class="eyebrow">HAIZ / ${who?.role === "teacher" ? "TEACHER DESK" : "CAMPUS"}<br><span class="badge">${pilot ? "HTTPS 试用 · 虚构数据" : "本地 DEMO"} · ${esc(who?.name || "访客")}</span></div><div class="actions">${who?.role === "teacher" ? '<button class="desktoponly" data-context>收起侧栏</button>' : ""}${pilot?'<a href="/world/classroom/">班级作业</a>':''}${themeButton()}<button data-logout>退出</button></div></div>`;
}
function nav(student = false) {
  const links = student
    ? [
        ["student", "今天"],
        ["clubs", "社团"],
        ["works", "作品"],
        ["settings", "偏好"],
      ]
    : [
        ["desk", "今日"],
        ["compose", "草稿"],
        ["history", "发布记录"],
      ];
  return `<nav class="bottomnav ${student ? "" : "mobileonly"}">${links.map(([id, t]) => `<a class="${route() === id ? "active" : ""}" href="#${id}">${t}</a>`).join("")}<a href="${pilot?'/world/classroom/':'../#world'}">${pilot?'班级作业':'世界 ↗'}</a></nav>`;
}
function shell(content, aside = true) {
  return `<div class="layout"><aside class="sidebar"><div class="brand">haiz<span>A SCHOOL THAT REMEMBERS</span></div><nav>${[
    ["desk", "◷　今日工作台"],
    ["compose", "＋　通知草稿"],
    ["history", "↗　发布记录"],
    ["settings", "◐　工作偏好"],
  ]
    .map(
      ([id, t]) =>
        `<a href="#${id}" class="${route() === id ? "active" : ""}">${t}</a>`,
    )
    .join(
      "",
    )}<a href="${pilot?'/world/classroom/':'../#homework'}">▤　班级作业</a><a href="${pilot?'/world/stillroom/':'../#world'}">${pilot?'↗　自习工具':'↗　校园世界'}</a></nav><button data-command>搜索 / Ctrl K</button><div class="foot">先整理，再确认。<br>公共屏只看见你允许的内容。<div class="line"></div>演示环境 · 未接入学校系统</div></aside><main class="workspace">${top()}${aside ? `<div class="deskgrid"><div>${content}</div>${context()}</div>` : content}</main></div>${nav()}`;
}
function context() {
  return `<aside class="context"><div class="card"><div class="eyebrow">YOUR RHYTHM</div><h2>此刻，${esc(mode)}</h2><label>工作情境<select id="mode">${["晨间", "课前", "办公", "收工"].map((x) => `<option ${mode === x ? "selected" : ""}>${x}</option>`).join("")}</select></label><p class="muted spaced modecopy">${{ 晨间: "从今天最重要的一件事开始。", 课前: "核对课程与材料，准备好再出发。", 办公: "把零散想法收成一份清晰的草稿。", 收工: "留下下一步，明天不用重新想起。" }[mode]}</p></div><div class="card"><div class="eyebrow">HANDOFF / 任务接力</div><h3>换一块屏幕，<br>继续同一件事。</h3><p class="muted spaced">${pilot ? "请管理员为另一设备签发同一教师身份的新邀请。服务端确认后的草稿会出现在工作台。" : "在另一浏览器窗口使用同一教师演示凭据。已同步的草稿会出现在工作台。"}</p><div class="line"></div><small id="syncstamp">${lastSync ? "最近同步 " + fmt(lastSync) : "等待连接本地服务"}</small></div><div class="quiet"><h3>公开前，再看一眼。</h3><p>私人正文不会投屏。仅你确认的摘要进入本班教室。</p></div></aside>`;
}
function dashboard() {
  const merged = new Map(data.drafts.map((d) => [d.id, d]));
  Object.values(local()).forEach((d) => {
    if (d.pending || !merged.has(d.id)) merged.set(d.id, d);
  });
  const next = workspace.courses
    .filter((c) => Date.parse(c.startsAt) >= Date.now() - 3600000)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))[0];
  return shell(
    `<div class="intro compact"><div><div class="eyebrow">HAIZ DESK / 虚构试用数据</div><h1>下一步，已经在这里。</h1></div><button class="primary" data-new>＋ 新建通知草稿</button></div><section class="card quick"><label for="quicknote">随手记 · 私人草稿</label><form id="quickform"><input id="quicknote" maxlength="200" placeholder="一句话记下，稍后完善…" required><button class="primary">记下并同步</button></form><small id="queuestatus">${pilot ? "私人缓存只在当前浏览器会话暂存，退出前请同步或导出。" : "仅私人草稿；未确认不会公开。"}</small></section><div class="twocol"><section class="card"><div class="eyebrow">下一节 · 手动录入</div><h2>${next ? esc(next.title) : "尚未录入课程"}</h2><p>${next ? esc(next.scope) + " · " + fmt(next.startsAt) : "添加虚构课程与资料描述，验证课前准备流程。"}</p><div class="actions spaced">${next ? `<button data-course-material="${next.id}">打开课前资料</button>` : ""}<button data-workspace="course">录入课程</button><button data-importcourses>导入示例</button></div></section><section class="card"><h2>待完成事项</h2>${
      workspace.tasks
        .filter((t) => t.status !== "done")
        .map(
          (t) =>
            `<div class="row"><div><h3>${esc(t.title)}</h3><small>${esc(t.scope)} · ${fmt(t.startsAt)}</small></div><button data-taskdone="${t.id}">完成</button></div>`,
        )
        .join("") || '<p class="muted">没有待办。需要时再记下一件。</p>'
    }<button class="spaced" data-workspace="task">添加待办</button></section></div><section class="card"><div class="row"><h2>继续未完成的草稿</h2><div class="actions"><button data-queue>同步全部</button><button data-refresh>刷新</button></div></div><div id="draftlist">${
      [...merged.values()]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map(
          (d) =>
            `<div class="row"><div><h3>${esc(d.title || "未命名草稿")}</h3><small>${esc(d.sourceDevice || "浏览器")} · ${d.remoteConflict ? "需要逐字段解决冲突" : d.pending ? "等待同步 / 仅本机" : "已同步 · v" + d.revision}</small></div><button data-open="${esc(d.id)}">继续 →</button></div>`,
        )
        .join("") || '<p class="empty">尚无草稿。用上面的随手记开始。</p>'
    }</div></section><section class="quiet"><h3>待确认通知</h3><p>${data.drafts.filter((d) => d.summary && !data.notices.some((n) => n.draftId === d.id && n.state === "published")).length} 份已有摘要，可进入草稿核对班级和有效期。</p><a href="#history">查看发布与撤回记录 →</a></section>`,
  );
}
function newDraft() {
  current = {
    id: crypto.randomUUID(),
    revision: 0,
    scope: who.scope,
    title: "",
    body: "",
    summary: "",
    ...dates(),
    updatedAt: new Date().toISOString(),
    sourceDevice: innerWidth < 650 ? "手机浏览器" : "桌面浏览器",
    pending: true,
    cursor: 0,
  };
  conflict = null;
  saveLocal();
  write(key() + ".selected", current.id, sessionStorage);
  location.hash = "compose";
  render();
}
function openDraft(id) {
  current = local()[id]?.pending
    ? local()[id]
    : data.drafts.find((d) => d.id === id) || local()[id];
  current = structuredClone(current);
  write(key() + ".selected", current.id, sessionStorage);
  conflict = current.remoteConflict || null;
  location.hash = "compose";
  render();
  $("#body")?.setSelectionRange(current.cursor || 0, current.cursor || 0);
}
function compose() {
  if (!current) {
    const selected = read(key() + ".selected", null, sessionStorage);
    const d =
      local()[selected] ||
      data.drafts.find((d) => d.id === selected) ||
      Object.values(local()).find((d) => d.pending) ||
      data.drafts[0];
    if (d) current = structuredClone(d);
    else
      return shell(
        '<div class="intro"><h1>把想法先留下。</h1></div><button class="primary" data-new>新建通知草稿</button>',
      );
  }
  return shell(
    `<div class="intro"><div><div class="eyebrow">DRAFT / PRIVATE UNTIL CONFIRMED</div><h1>把话说清楚。</h1><p>01 记录　→　02 核对　→　03 公开摘要</p></div></div><div id="conflict"></div><div class="status" id="editstatus">${current.pending ? (privateStorageAvailable ? "仅本机保存 · 等待同步" : "仅内存保留 · 存储不可用，请导出") : "已同步 · v" + current.revision} · ${esc(current.sourceDevice)}</div><form class="editor" id="editor"><div class="card"><label>通知标题<input id="title" maxlength="100" value="${esc(current.title)}" placeholder="例如：明日实验课材料提醒"></label><label>私人正文 · 不进入教室公共屏<textarea id="body" maxlength="8000" placeholder="先留下背景、准备事项或尚未确定的想法…">${esc(current.body)}</textarea></label><div class="actions"><button type="button" data-suggest>整理成摘要建议</button><button type="button" data-export>导出文字</button></div><p class="note">本地规则建议，可关闭，无在线 AI 调用。应用建议后仍需你预览确认。</p><label>资料名称 / 描述 · 只同步文字<textarea id="materialNotes" maxlength="1500" placeholder="例如：实验记录纸.pdf · 请从学校授权资料库取原文件">${esc(current.materialNotes || "")}</textarea></label><div class="filepicker"><button type="button" data-filepick>选择本机参考图片</button><input id="file" type="file" accept="image/png,image/jpeg,image/webp" multiple hidden><span>图片只在当前会话预览，未上传</span></div><div id="attachment" class="attachment"></div></div><div class="card"><h2>接收范围与公开内容</h2><label>授权班级<select id="scope">${(who.scopes || [who.scope]).map((scope) => `<option ${scope === current.scope ? "selected" : ""}>${esc(scope)}</option>`).join("")}</select><small>切换班级后，发布前必须重新核对公开预览。</small></label><label>教室公开摘要<textarea class="summary" id="summary" maxlength="280" placeholder="只写允许出现在教室屏上的内容">${esc(current.summary)}</textarea></label><div class="twocol"><label>生效时间<input id="startsAt" type="text" inputmode="numeric" placeholder="年-月-日 时:分" value="${toLocal(current.startsAt).replace("T", " ")}"></label><label>失效时间<input id="expiresAt" type="text" inputmode="numeric" placeholder="年-月-日 时:分" value="${toLocal(current.expiresAt).replace("T", " ")}"></label></div><p class="muted">不包含私人正文、图片、个人成绩或学生身份信息。</p></div><div class="toolbar"><button class="primary" type="button" data-save>保存并同步</button><button type="button" data-preview>预览公开屏 →</button></div></form>`,
  );
}
function collect() {
  if (!current || !$("#editor")) return;
  for (const f of ["title", "body", "summary", "scope", "materialNotes"])
    current[f] = $("#" + f).value;
  current.invalidDates = false;
  for (const f of ["startsAt", "expiresAt"]) {
    const v = $("#" + f).value.replace(" ", "T");
    if (v && Number.isFinite(Date.parse(v)))
      current[f] = new Date(v).toISOString();
    else current.invalidDates = true;
  }
  current.cursor = $("#body").selectionStart;
  current.pending = true;
  current.updatedAt = new Date().toISOString();
  current.sourceDevice = innerWidth < 650 ? "手机浏览器" : "桌面浏览器";
  delete current.request;
  const saved = saveLocal();
  $("#editstatus").textContent = saved
    ? "仅本机保存 · 等待同步"
    : "仅内存保留 · 存储不可用，请导出";
}
async function syncDraft() {
  if (!current || busy) return false;
  if (current.invalidDates) {
    toast("日期格式应为年-月-日 时:分，请修正后保存");
    return false;
  }
  busy = true;
  const version = current.revision,
    id = current.id,
    copy = structuredClone(current);
  if (!copy.request) {
    copy.request = {
      id: crypto.randomUUID(),
      body: { ...copy, expectedRevision: version },
    };
    current.request = copy.request;
    saveLocal();
  }
  try {
    const { draft } = await api("drafts", copy.request.body, copy.request.id);
    const changed =
      JSON.stringify({ ...current, request: null }) !==
      JSON.stringify({ ...copy, request: null });
    if (current.id === id) {
      if (changed) {
        current.revision = draft.revision;
        delete current.request;
        saveLocal();
      } else {
        current = { ...draft, pending: false };
        saveLocal();
      }
      conflict = null;
      if ($("#editstatus"))
        $("#editstatus").textContent = current.pending
          ? "更新已留在本机，请继续同步"
          : "已同步 · v" + draft.revision;
      $("#conflict")?.replaceChildren();
    }
    await refresh(false);
    return !changed;
  } catch (e) {
    if (e.status === 409 && e.remote) {
      conflict = e.remote;
      showConflict();
    } else toast(e.message || "同步失败；本机草稿已保留");
    return false;
  } finally {
    busy = false;
  }
}
function showConflict() {
  if (!$("#conflict") || !conflict) return;
  const fields = [
    ["title", "标题"],
    ["body", "私人正文"],
    ["summary", "公开摘要"],
    ["startsAt", "生效时间"],
    ["expiresAt", "失效时间"],
    ["scope", "班级范围"],
    ["materialNotes", "资料名称与描述"],
  ];
  $("#conflict").innerHTML =
    `<section class="conflict"><h2>逐项核对，两端的更改。</h2><p>本机 ${esc(current.sourceDevice)} / ${fmt(current.updatedAt)}；远端 ${esc(conflict.sourceDevice)} / ${fmt(conflict.updatedAt)} · v${conflict.revision}</p><p>先选择每一项，再保存新版本。公开摘要、班级和时间会影响接收范围，不会自动拼接正文。</p>${fields.map(([f, label]) => `<details ${String(current[f] || "") !== String(conflict[f] || "") ? "open" : ""}><summary>${label} · ${String(current[f] || "") !== String(conflict[f] || "") ? "两端不同" : "一致"}</summary><div class="twocol"><pre>本机：${esc(current[f])}</pre><pre>远端：${esc(conflict[f])}</pre></div><label>采用哪一份<select data-field-choice="${f}"><option value="local">本机</option><option value="remote">远端</option><option value="manual">手工编辑下方内容</option></select></label><textarea data-field-manual="${f}" aria-label="手工编辑${label}">${esc(current[f])}</textarea></details>`).join("")}<div class="actions spaced"><button data-resolve="local">全部保留本机</button><button data-resolve="remote">全部保留远端</button><button data-resolve="merge">应用逐字段选择</button></div></section>`;
  $("#editstatus").textContent = "版本冲突 · 未覆盖任何一端";
  $("#conflict")
    .querySelectorAll("[data-resolve]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          const history = read(key() + ".recovery", []);
          history.push({
            local: structuredClone(current),
            remote: structuredClone(conflict),
            at: new Date().toISOString(),
          });
          write(key() + ".recovery", history);
          if (b.dataset.resolve === "remote")
            current = { ...conflict, pending: false };
          else {
            if (b.dataset.resolve === "merge")
              for (const [f] of fields) {
                const choice = $(`[data-field-choice="${f}"]`).value;
                if (choice === "remote") current[f] = conflict[f] || "";
                if (choice === "manual")
                  current[f] = $(`[data-field-manual="${f}"]`).value;
              }
            current.revision = conflict.revision;
            current.pending = true;
            delete current.request;
            delete current.remoteConflict;
          }
          saveLocal();
          conflict = null;
          render();
          toast("已应用选择；请核对并保存，再预览发布");
        }),
    );
}
async function preview() {
  collect();
  if (!(await syncDraft())) return;
  const d = structuredClone(current);
  modal(
    `<div class="eyebrow">PUBLIC SCREEN PREVIEW</div><h2>这是教室将看见的全部。</h2><div class="preview"><small>${esc(d.scope)}</small><h2>${esc(d.title)}</h2><p>${esc(d.summary)}</p><small>${fmt(d.startsAt)} — ${fmt(d.expiresAt)}</small></div><p>私人正文和本机图片不会公开。演示策略：本班教师有权确认发布，不代表真实学校审批制度。</p><label><input type="checkbox" id="confirm">我已核对班级、摘要与有效期，确认允许公开展示。</label><div class="actions"><button class="primary" id="publish">确认发布</button><button data-close>返回修改</button></div>`,
  );
  $("#publish").onclick = async () => {
    if (!$("#confirm").checked) return toast("请先核对并勾选确认");
    $("#publish").disabled = true;
    try {
      await api(
        "publish",
        {
          id: d.id,
          expectedRevision: d.revision,
          confirmed: true,
          confirmedSummary: d.summary,
        },
        "publish-" + d.id + "-" + d.revision,
      );
      $("#modal").close();
      await refresh(false);
      location.hash = "history";
      toast("服务端已确认发布");
    } catch (e) {
      toast(e.message);
      $("#publish").disabled = false;
    }
  };
}
function history() {
  return shell(
    `<div class="intro"><div><div class="eyebrow">PUBLISHED / TRACEABLE</div><h1>每一次公开，<br><span class="serif">都有来处。</span></h1></div></div><div class="card">${data.notices.map((n) => `<div class="row"><div><h3>${esc(n.title)}</h3><p>${esc(n.summary)}</p><small>${n.state === "revoked" ? "已撤回" : Date.parse(n.expiresAt) < Date.now() ? "已过期" : Date.parse(n.startsAt) > Date.now() ? "待生效" : "已发布"} · v${n.revision} · ${esc(n.scope)}</small></div>${n.state === "published" ? `<button class="danger" data-revoke="${n.id}">撤回</button>` : ""}</div>`).join("") || '<p class="empty">还没有公开内容。</p>'}</div><div class="card"><h2>我的操作记录</h2>${data.audit
      .slice(-12)
      .reverse()
      .map(
        (a) =>
          `<div class="row"><span>${{ draft_saved: "保存草稿", notice_published: "确认发布", notice_revoked: "撤回公告", course_saved: "保存课程", task_saved: "更新待办" }[a.action]} · v${a.revision}</span><small>${fmt(a.at)}</small></div>`,
      )
      .join("")}</div>`,
  );
}
const clubs = [
  {
    id: "photo",
    name: "光影观察组",
    tag: "摄影",
    title: "看见<br>日常之美。",
    desc: "带着一个取景框，重新看看经过了很多次的树影。",
  },
  {
    id: "code",
    name: "小小造物社",
    tag: "科技",
    title: "有些想法，<br>值得按下运行。",
    desc: "从一个校园小工具开始，做一件能帮到身边人的作品。",
  },
  {
    id: "write",
    name: "纸间文学社",
    tag: "文学",
    title: "文字先落地，<br>答案慢慢来。",
    desc: "一段故事、一首短诗，给想法留一页空白。",
  },
];
function student() {
  return `<main class="student">${top()}<div class="intro"><div><div class="eyebrow">A SCHOOL, MANY WORLDS</div><h1>今天也有<br><span class="serif">值得期待的事。</span></h1><p>${tone === "quiet" ? "按自己的节奏，开始今天。" : tone === "abstract" ? "今天的灵感，还没有被上课铃点名。" : "校园的一角，留给你的好奇心。"}</p></div></div><div class="card course"><div class="eyebrow">示例课程 / 未连接教务</div><h2>英语</h2><p>下一节课程示意 · 教学楼 A403</p><small>具体时间以本班正式课表为准</small></div><div class="card"><h2>班级公共信息</h2><div id="studentfeed">连接后显示经过确认的公开摘要。</div></div><div class="clubgrid"><a class="card art green" href="#clubs"><h2>一些有趣的人，<br>正在相遇。</h2><p>探索示例社团 ↗</p></a><a class="card art peach" href="../stillroom/"><h2>留一会儿<br>安静。</h2><p>思维续航与自习 ↗</p></a></div><a class="btn" href="${pilot?'/world/classroom/':'../#assignments'}">查看班级作业</a></main>${nav(true)}`;
}
function clubPage() {
  return `<main class="student">${top()}<div class="intro"><div><div class="eyebrow">FIND YOUR PEOPLE</div><h1>和有趣的人，<br><span class="serif">一起做有趣的事。</span></h1><p>以下均为示例社团，无真实报名或人数。</p></div></div><input id="clubsearch" aria-label="搜索社团" placeholder="搜索名称、摄影、科技、文学"><div class="clubgrid spaced" id="clublist">${clubCards(clubs)}</div></main>${nav(true)}`;
}
function clubCards(items) {
  return (
    items
      .map(
        (c) =>
          `<article class="card"><div class="art ${c.id === "code" ? "peach" : "green"}"><div class="eyebrow">${c.tag} / CONCEPT</div><h2>${c.title}</h2></div><h3 class="spaced">${c.name}</h3><p class="muted">${c.desc}</p><button data-club="${c.id}">查看示例活动 →</button></article>`,
      )
      .join("") || '<p class="empty">没有匹配的社团。</p>'
  );
}
function works() {
  const work = read(key() + ".work", { title: "", body: "" });
  return `<main class="student works">${top()}<div class="intro"><div><div class="eyebrow">YOUR SMALL BIG IDEA</div><h1>先留住，<br><span class="serif">再慢慢长大。</span></h1><p>仅本机作品草稿，不公开、不上传。</p></div></div><div class="card editor"><label>作品标题<input id="worktitle" value="${esc(work.title)}" placeholder="给灵感起个名字"></label><label>文字 / 项目笔记<textarea id="workbody" placeholder="可以很小，也可以还没有答案。">${esc(work.body)}</textarea></label><div class="actions"><button class="primary" data-worksave>保存作品草稿</button><button data-workexport>导出文字</button></div><p id="workstatus" class="spaced muted">${work.at ? "本机保存于 " + fmt(work.at) : "未保存"}</p></div></main>${nav(true)}`;
}
function settings() {
  const inner = `<div class="intro"><h1>按自己的节奏。</h1></div><div class="card settings"><label>界面主题<select id="themechoice">${[
    ["light", "浅色"],
    ["dark", "深色"],
    ["contrast", "高对比"],
  ]
    .map(
      ([v, t]) =>
        `<option value="${v}" ${theme === v ? "selected" : ""}>${t}</option>`,
    )
    .join("")}</select></label><label>学生内容语气<select id="tone">${[
    ["quiet", "安静"],
    ["playful", "有趣"],
    ["abstract", "抽象"],
  ]
    .map(
      ([v, t]) =>
        `<option value="${v}" ${tone === v ? "selected" : ""}>${t}</option>`,
    )
    .join(
      "",
    )}</select></label><label><span>本地整理建议</span><select id="ai"><option value="on">启用本地规则</option><option value="off" ${read("haiz.flow.noai", false) ? "selected" : ""}>关闭建议</option></select></label><p>权限、错误和发布确认始终清晰。动效遵循系统减少动态偏好。</p><div class="line"></div><button data-recovery>导出冲突恢复历史</button><p class="note">退出会清理本身份的私人缓存，请先导出需要保留的文字；服务端草稿不会因此删除。</p></div>`;
  return who.role === "teacher"
    ? shell(inner)
    : `<main class="student">${top()}${inner}</main>${nav(true)}`;
}
function classroom() {
  return `<main class="screen"><section><div class="eyebrow">HAIZ CLASSROOM · ${esc(who.scope)}</div><div class="clock" id="clock"></div><h1 id="current-course">安心上课。</h1><h2 id="next-course"></h2><p style="font-size:24px">课程来源：独立 Demo<br>ClassIsland 未连接</p><p class="spaced" style="font-size:20px">晚修作业按现有模块中的最后两节自习判定。</p></section><section><div class="eyebrow">PUBLIC / CONFIRMED</div><h1>班级提醒</h1><div id="feed"></div></section><footer class="screenfoot"><div id="feedstate">等待同步</div><div class="screen-controls"><button data-pure>纯净课堂</button><button data-hide>手动隐藏</button><button data-logout>退出</button><a href="${pilot?'/world/classroom/':'../#classroom'}">${pilot?'班级作业清单 ↗':'原晚修大屏 ↗'}</a></div></footer></main>`;
}
function login() {
  return `<main class="login"><div class="brand">haiz<span>A SCHOOL THAT REMEMBERS</span></div><h1>换一块屏幕，<br><span class="serif">继续同一件事。</span></h1><p class="muted">进入本地演示。教师、学生和教室使用各自的演示凭据，权限由服务端校验。</p><form id="login"><label>本地演示凭据<input id="token" type="password" autocomplete="off" required placeholder="输入服务启动时生成的凭据"></label><button class="primary" type="submit">连接演示服务 →</button></form><p class="note">启动：node world/scripts/classroom-server.mjs<br>凭据位于 world/.haiz-demo/local-demo-keys.json。这不是学校账号。服务仅监听本机，跨端通过独立浏览器会话验证。</p><a href="../#world">返回校园世界</a></main>`;
}
function render() {
  if (!who) {
    $("#app").innerHTML = pilot ? pilotLogin() : login();
    $("#login").onsubmit = async (e) => {
      e.preventDefault();
      if (!pilot) token = $("#token").value;
      try {
        const r = pilot
          ? await api("login", {
              invite: $("#token").value,
              fictionalOnly: $("#fictional").checked,
            })
          : await api("me");
        who = r.identity;
        if (
          ![
            "teacher",
            "student",
            "display",
            ...(pilot ? ["admin"] : []),
          ].includes(who.role)
        ) {
          who = null;
          return toast("请使用教师、学生或教室凭据");
        }
        if (!pilot) write("haiz.flow.token", token, sessionStorage);
        write("haiz.flow.identity", who, sessionStorage);
        await refresh(false);
        location.hash =
          who.role === "teacher"
            ? "desk"
            : who.role === "display"
              ? "classroom"
              : "student";
        render();
      } catch (e) {
        toast(e.message);
      }
    };
    return;
  }
  const r = route();
  if (who.role === "admin") {
    $("#app").innerHTML =
      `<main class="student">${top()}<h1>短期试用管理</h1><div id="adminpanel" class="spaced">读取管理状态…</div></main>`;
    bind();
    loadAdmin();
    return;
  }
  if (who.role === "display") $("#app").innerHTML = classroom();
  else if (who.role === "student")
    $("#app").innerHTML =
      r === "clubs"
        ? clubPage()
        : r === "works"
          ? works()
          : r === "settings"
            ? settings()
            : student();
  else
    $("#app").innerHTML =
      r === "compose"
        ? compose()
        : r === "history"
          ? history()
          : r === "settings"
            ? settings()
            : dashboard();
  if (pilot)
    document
      .querySelectorAll('a[href^="../"]:not([href="../stillroom/"])')
      .forEach((a) => {
        a.href =
          "https://github.com/manyIwant/haiz/tree/feat/haiz-pilot-hardening";
        a.textContent = a.getAttribute("data-source-label") || "查看完整校园项目 ↗";
        if (a.previousElementSibling?.href === a.href) a.remove();
        a.rel = "noopener noreferrer";
        a.target = "_blank";
      });
  bind();
  if (conflict) showConflict();
  if (who.role !== "teacher") refreshFeed();
}
function download(name, text) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/plain;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function bind() {
  bindWorkspace();
  $("[data-context]")?.addEventListener("click", (e) => {
    const g = $(".deskgrid");
    if (!g) return;
    g.classList.toggle("collapsed");
    e.target.textContent = g.classList.contains("collapsed")
      ? "展开侧栏"
      : "收起侧栏";
  });
  document.querySelectorAll("button[data-theme]").forEach(
    (b) =>
      (b.onclick = () => {
        theme =
          theme === "light" ? "dark" : theme === "dark" ? "contrast" : "light";
        document.body.dataset.theme = theme;
        write("haiz.flow.theme", theme);
      }),
  );
  document.querySelectorAll("[data-logout]").forEach(
    (b) =>
      (b.onclick = () => {
        modal(
          '<h2>退出当前演示身份</h2><p>将清理本机私人草稿、作品和冲突历史。服务端已同步草稿仍会保留。</p><div class="actions"><button id="logout-confirm" class="danger">清理并退出</button><button data-close>取消</button></div>',
        );
        $("#logout-confirm").onclick = async () => {
          if (pilot) {
            try {
              await api("logout", {});
            } catch (e) {
              if (e.status !== 401)
                return toast("服务器未确认撤销，请联网后重试");
            }
          }
          authEpoch++;
          for (const k of [key(), key() + ".work", key() + ".recovery"]) {
            localStorage.removeItem(k);
            sessionStorage.removeItem(k);
          }
          sessionStorage.removeItem("haiz.flow.token");
          sessionStorage.removeItem("haiz.flow.identity");
          sessionStorage.removeItem("haiz-stillroom-v1");
          who = null;
          token = "";
          current = null;
          workspace = { courses: [], tasks: [] };
          feedCache = null;
          data = { drafts: [], notices: [], audit: [] };
          $("#modal").close();
          render();
        };
      }),
  );
  document
    .querySelectorAll("[data-new]")
    .forEach((b) => (b.onclick = newDraft));
  document
    .querySelectorAll("[data-open]")
    .forEach((b) => (b.onclick = () => openDraft(b.dataset.open)));
  $("[data-refresh]")?.addEventListener("click", () => refresh(true));
  $("[data-command]")?.addEventListener("click", command);
  $("#mode")?.addEventListener("change", (e) => {
    mode = e.target.value;
    write("haiz.flow.mode", mode);
    $(".modecopy").textContent = "已手动切换为" + mode + "，当前编辑内容保留。";
  });
  $("[data-material]")?.addEventListener("click", () =>
    modal(
      "<h2>实验课 · 示例准备清单</h2><p>① 核对实验安全说明\n② 准备实验记录纸\n③ 检查器材数量\n\n这是一份本地模板，不是学校正式课件。</p><button data-close>已查看</button>",
    ),
  );
  if ($("#editor")) {
    $("#editor").onsubmit = (e) => e.preventDefault();
    $("#editor").oninput = (e) => {
      if (e.target.id === "file") return;
      collect();
    };
    $("[data-save]").onclick = async () => {
      collect();
      await syncDraft();
    };
    $("[data-preview]").onclick = preview;
    $("[data-export]").onclick = () =>
      download(
        "HAIZ-private-draft.txt",
        current.title +
          "\n\n" +
          current.body +
          "\n\n公开摘要：\n" +
          current.summary,
      );
    $("[data-suggest]").onclick = () => {
      if (read("haiz.flow.noai", false))
        return toast("本地建议已关闭，仍可手动编辑");
      const candidates = suggestActions(current.body);
      modal(
        `<h2>本地规则候选 · 不代表理解上下文</h2><p>关键词匹配，日期只提示、不自动换算。逐项选择后可继续编辑，未确认不会发布。</p>${candidates.map((c, i) => `<label><input type="checkbox" data-candidate="${i}"><span>${esc(c.text)}<br><small>${c.kind} · ${c.dateHint}</small></span></label>`).join("") || "<p>没有识别出明确行动词，请直接手动填写。</p>"}<div class="actions"><button id="applysuggestion">将选中项放入摘要</button><button data-close>取消</button></div>`,
      );
      $("#applysuggestion").onclick = () => {
        const selected = [
          ...document.querySelectorAll("[data-candidate]:checked"),
        ].map((e) => candidates[Number(e.dataset.candidate)].text);
        if (!selected.length) return toast("请至少选择一项，或返回手工编辑");
        $("#summary").value = selected.join("。").slice(0, 280);
        collect();
        $("#modal").close();
      };
    };
    const importFile = async (f) => {
      if (!f) return;
      if (
        !["image/png", "image/jpeg", "image/webp"].includes(f.type) ||
        f.size > 2 * 1024 * 1024
      )
        return toast("只接受2MB以内PNG、JPEG、WebP");
      $("#materialNotes").value = (
        $("#materialNotes").value +
        "\n" +
        f.name +
        "（仅名称；原文件未上传）"
      )
        .trim()
        .slice(0, 1500);
      collect();
      const url = URL.createObjectURL(f);
      $("#attachment").innerHTML =
        `<img alt="主动选择的本机参考图"><small>${esc(f.name)}<br>仅当前会话可预览；不会自动上传。</small>`;
      $("#attachment img").src = url;
      $("#attachment img").onload = () => URL.revokeObjectURL(url);
    };
    $("[data-filepick]").onclick = () => $("#file").click();
    $("#file").onchange = (e) => {
      for (const file of [...e.target.files].slice(0, 5)) importFile(file);
    };
    $("#editor").ondragover = (e) => e.preventDefault();
    $("#editor").ondrop = (e) => {
      e.preventDefault();
      for (const file of [...e.dataTransfer.files].slice(0, 5))
        importFile(file);
    };
  }
  document.querySelectorAll("[data-revoke]").forEach(
    (b) =>
      (b.onclick = () => {
        const n = data.notices.find((n) => n.id === b.dataset.revoke);
        modal(
          `<h2>撤回「${esc(n.title)}」？</h2><p>在线教室将停止展示。离线教室重新同步后移除；到期内容始终隐藏。</p><div class="actions"><button class="danger" id="revoke-confirm">确认撤回</button><button data-close>取消</button></div>`,
        );
        $("#revoke-confirm").onclick = async () => {
          try {
            await api(
              "revoke",
              { id: n.id, expectedRevision: n.revision },
              "revoke-" + n.id + "-" + n.revision,
            );
            $("#modal").close();
            await refresh(true);
          } catch (e) {
            toast(e.message);
          }
        };
      }),
  );
  function bindClubs() {
    document.querySelectorAll("[data-club]").forEach(
      (b) =>
        (b.onclick = () => {
          const c = clubs.find((c) => c.id === b.dataset.club);
          modal(
            `<div class="eyebrow">CONCEPT / 示例活动</div><h2>${c.name} · 一周小创作</h2><p>${c.desc}\n\n暂无真实组织授权，因此不提供真实报名。</p><div class="actions"><button id="startwork">建立本机作品草稿</button><button data-close>关闭</button></div>`,
          );
          $("#startwork").onclick = () => {
            if (!read(key() + ".work", null))
              write(key() + ".work", {
                title: c.name + " · 我的第一次创作",
                body: "",
                at: new Date().toISOString(),
              });
            $("#modal").close();
            location.hash = "works";
          };
        }),
    );
  }
  bindClubs();
  $("#clubsearch")?.addEventListener("input", (e) => {
    $("#clublist").innerHTML = clubCards(
      clubs.filter((c) => (c.name + c.tag + c.desc).includes(e.target.value)),
    );
    bindClubs();
  });
  $("[data-worksave]")?.addEventListener("click", () => {
    const at = new Date().toISOString();
    if (
      write(key() + ".work", {
        title: $("#worktitle").value,
        body: $("#workbody").value,
        at,
      })
    )
      $("#workstatus").textContent = "仅本机保存 · " + fmt(at);
  });
  $("[data-workexport]")?.addEventListener("click", () =>
    download(
      "HAIZ-work.txt",
      $("#worktitle").value + "\n\n" + $("#workbody").value,
    ),
  );
  $("#tone")?.addEventListener("change", (e) => {
    tone = e.target.value;
    write("haiz.flow.tone", tone);
  });
  $("#themechoice")?.addEventListener("change", (e) => {
    theme = e.target.value;
    write("haiz.flow.theme", theme);
    document.body.dataset.theme = theme;
  });
  $("#ai")?.addEventListener("change", (e) =>
    write("haiz.flow.noai", e.target.value === "off"),
  );
  $("[data-recovery]")?.addEventListener("click", () =>
    download(
      "HAIZ-conflict-recovery.json",
      JSON.stringify(read(key() + ".recovery", []), null, 2),
    ),
  );
  $("[data-pure]")?.addEventListener("click", (e) => {
    $(".screen").classList.toggle("pure");
    e.target.textContent = $(".screen").classList.contains("pure")
      ? "恢复课堂信息"
      : "纯净课堂";
  });
  $("[data-hide]")?.addEventListener("click", (e) => {
    $("#feed").classList.toggle("hidden");
    e.target.textContent = $("#feed").classList.contains("hidden")
      ? "显示提醒"
      : "手动隐藏";
  });
}
function command() {
  if (!who || who.role !== "teacher") return;
  modal(
    '<h2>找到下一步</h2><input id="commandquery" aria-label="搜索任务" placeholder="搜索草稿标题，或今日、发布记录"><div id="commandresults" class="stack spaced"></div><button data-close class="spaced">关闭</button>',
  );
  const update = () => {
    const q = $("#commandquery").value;
    $("#commandresults").innerHTML =
      [
        ["今日工作台", "desk"],
        ["新建通知草稿", "new"],
        ["发布记录", "history"],
      ]
        .filter(([t]) => t.includes(q))
        .map(([t, r]) => `<button data-route="${r}">${t}</button>`)
        .join("") +
      data.drafts
        .filter((d) => d.title.includes(q))
        .map((d) => `<button data-id="${d.id}">${esc(d.title)}</button>`)
        .join("") +
      workspace.courses
        .filter((c) => (c.title + c.materialNotes).includes(q))
        .map(
          (c) =>
            `<button data-course="${c.id}">课程与资料 · ${esc(c.title)}</button>`,
        )
        .join("");
    $("#commandresults")
      .querySelectorAll("button")
      .forEach(
        (b) =>
          (b.onclick = () => {
            $("#modal").close();
            if (b.dataset.course) {
              const c = workspace.courses.find(
                (c) => c.id === b.dataset.course,
              );
              modal(
                `<h2>${esc(c.title)}</h2><p>${esc(c.materialNotes || "暂无资料描述")}</p><p>原文件未上传，仅同步名称和说明。</p><button data-close>关闭</button>`,
              );
              return;
            }
            if (b.dataset.id) openDraft(b.dataset.id);
            else if (b.dataset.route === "new") newDraft();
            else location.hash = b.dataset.route;
          }),
      );
  };
  $("#commandquery").oninput = update;
  update();
  $("#commandquery").focus();
}
async function refresh(rerender = false) {
  if (!who || who.role !== "teacher") return;
  try {
    const next = await api("drafts");
    const nextWorkspace = await api("workspace");
    const changed =
      JSON.stringify([data.drafts, data.notices, data.audit, workspace]) !==
      JSON.stringify([next.drafts, next.notices, next.audit, nextWorkspace]);
    workspace = nextWorkspace;
    data = next;
    lastSync = data.serverTime;
    online = true;
    if (rerender && changed && route() !== "compose") render();
    $("#syncstamp") &&
      ($("#syncstamp").textContent = "最近同步 " + fmt(lastSync));
  } catch {
    online = false;
    if (rerender) toast("未连接服务；本机草稿仍保留");
  }
}
let feedCache = null;
function paintFeed() {
  if (!who || ["teacher", "admin"].includes(who.role)) return;
  const cache =
    feedCache || read("haiz.flow.public." + who.scope, { notices: [] });
  const clockKey = "haiz.flow.clock." + who.scope;
  const now = Math.max(Date.now(), read(clockKey, 0));
  write(clockKey, now);
  const notices = (
    pilot && Date.now() - Date.parse(cache.serverTime) > 15 * 60000
      ? []
      : cache.notices
  ).filter(
    (n) => Date.parse(n.startsAt) <= now && Date.parse(n.expiresAt) > now,
  );
  const pageIndex = notices.length
    ? Math.floor(now / 12000) % notices.length
    : 0;
  const shown =
    who.role === "display" ? notices.slice(pageIndex, pageIndex + 1) : notices;
  if ($("#current-course"))
    $("#current-course").textContent = cache.bridge?.available
      ? cache.bridge.current
      : "课表未连接";
  if ($("#next-course"))
    $("#next-course").textContent = cache.bridge?.available
      ? "下一节 · " + cache.bridge.next + "（模拟）"
      : "请以本班正式课表为准";
  const target = $("#feed") || $("#studentfeed");
  if (target)
    target.innerHTML =
      shown
        .map(
          (n) =>
            `<article class="public-notice"><h2>${esc(n.title)}</h2><p>${esc(n.summary)}</p><small>有效至 ${fmt(n.expiresAt)} · v${n.revision}</small></article>`,
        )
        .join("") || '<p class="empty">当前没有有效公共提醒。</p>';
  if ($("#feedstate"))
    $("#feedstate").textContent =
      (online
        ? "已连接本地演示服务"
        : "离线 · 内容可能已撤回，仅保留未到期缓存") +
      " · 上次成功同步 " +
      fmt(cache.serverTime) +
      (notices.length > 1
        ? ` · ${pageIndex + 1}/${notices.length} · 12秒轮换`
        : "");
  if ($("#clock"))
    $("#clock").textContent = new Date().toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
}
async function refreshFeed() {
  if (!who || ["teacher", "admin"].includes(who.role)) return;
  try {
    feedCache = await api("feed");
    write("haiz.flow.public." + who.scope, feedCache);
    online = true;
  } catch (e) {
    online = false;
    if (e.status === 401 || e.status === 403) {
      feedCache = { notices: [] };
      localStorage.removeItem("haiz.flow.public." + who.scope);
    }
  }
  paintFeed();
}
function pilotLogin() {
  return `<main class="login"><div class="brand">haiz<span>三人远程试用 · 仅虚构数据</span></div><h1>接着做，<br><span class="serif">不必重新开始。</span></h1><p>邀请码一次有效、30分钟到期。同一教师在另一台设备使用管理员单独签发的新邀请。</p><form id="login"><label>短期邀请码<input id="token" type="password" autocomplete="off" required placeholder="粘贴管理员私下提供的邀请码"></label><label class="consent"><input type="checkbox" id="fictional" required>我只录入虚构数据，并在个人可信浏览器试用；私人草稿仅在当前会话暂存。</label><button class="primary" type="submit">连接试用服务 →</button></form><p class="note">无需学校账号、Apple ID或设备权限。退出前同步或导出未完成文字。请勿输入真实姓名、成绩或教学机密。</p></main>`;
}
function expireSession() {
  const backup =
    who?.role === "teacher"
      ? Object.values(local()).filter((d) => d.pending)
      : [];
  if (current?.pending && !backup.some((d) => d.id === current.id))
    backup.push(current);
  const ownerKey = key();
  for (const store of [localStorage, sessionStorage])
    for (const k of [ownerKey, ownerKey + ".work", ownerKey + ".recovery"])
      store.removeItem(k);
  if (who) localStorage.removeItem("haiz.flow.public." + who.scope);
  sessionStorage.removeItem("haiz.flow.identity");
  who = null;
  authEpoch++;
  current = null;
  feedCache = null;
  render();
  if (backup.length) {
    modal(
      '<h2>会话已失效</h2><p>服务端已拒绝访问。未同步文字保留在此窗口供你导出；重新进入前请保存备份。</p><div class="actions"><button id="expiredexport">导出未同步文字</button><button data-close>关闭</button></div>',
    );
    $("#expiredexport").onclick = () =>
      download("HAIZ-unsynced.json", JSON.stringify(backup, null, 2));
  } else toast("会话已失效，请使用新邀请重新进入");
}
async function loadAdmin() {
  try {
    const state = await api("admin");
    if (!$("#adminpanel")) return;
    $("#adminpanel").innerHTML =
      `<section class="card"><h2>为每台设备签发邀请</h2><p>同一教师的手机与桌面，选择相同身份，分别签发。邀请码一次有效，30分钟过期；会话8小时过期。</p><label>演示身份<select id="inviteaccount">${state.accounts.map((a) => `<option value="${a.name}">${a.name} · ${a.role} · ${esc(a.scope)}</option>`).join("")}</select></label><button class="primary spaced" id="makeinvite">签发一次性邀请</button><p id="inviteoutput" class="invite-output" role="status"></p></section><section class="card"><h2>设备会话</h2>${state.sessions.map((s) => `<div class="row"><div><h3>${s.account}</h3><small>${fmt(s.createdAt)} → ${fmt(s.expiresAt)} · ${s.revoked ? "已撤销" : "有效期内"}</small><small>${s.id}</small></div>${!s.revoked ? `<button data-revokesession="${s.id}">撤销</button>` : ""}</div>`).join("")}</section><section class="card"><h2>结束本次试用</h2><p>最多24个会话；每位教师100份草稿；公开通知200条。清理会删除服务器业务数据、撤销其他会话及未使用邀请，保留当前管理员会话和不含正文的安全日志。</p><button id="resetpilot" class="danger spaced">清理虚构数据</button></section>`;
    $("#makeinvite").onclick = async () => {
      try {
        const r = await api("admin/invite", {
          account: $("#inviteaccount").value,
        });
        $("#inviteoutput").textContent =
          r.invite +
          "\n有效至 " +
          fmt(r.expiresAt) +
          "\n仅私下交给测试者，不要放进截图或仓库。";
      } catch (e) {
        toast(e.message);
      }
    };
    document.querySelectorAll("[data-revokesession]").forEach(
      (b) =>
        (b.onclick = async () => {
          try {
            await api("admin/revoke", { id: b.dataset.revokesession });
            await loadAdmin();
          } catch (e) {
            toast(e.message);
          }
        }),
    );
    $("#resetpilot").onclick = () => {
      modal(
        '<h2>清理服务器上的虚构数据</h2><p>此操作不可恢复。其他设备会话将被撤销。离线设备无法接收清理，须在这些设备上主动退出或清理站点缓存。</p><input id="resettext" aria-label="输入清理虚构数据" placeholder="输入：清理虚构数据"><div class="actions spaced"><button id="resetconfirm" class="danger">确认清理</button><button data-close>取消</button></div>',
      );
      $("#resetconfirm").onclick = async () => {
        try {
          await api("admin/reset", { confirm: $("#resettext").value });
          $("#modal").close();
          loadAdmin();
        } catch (e) {
          toast(e.message);
        }
      };
    };
  } catch (e) {
    toast(e.message);
  }
}
let queueBusy = false;
async function syncQueue() {
  if (queueBusy || busy || who?.role !== "teacher" || !navigator.onLine) return;
  queueBusy = true;
  let synced = 0,
    conflicts = 0;
  try {
    for (const cached of Object.values(local()).filter(
      (d) => d.pending && d.title && !d.invalidDates,
    )) {
      if (cached.id === current?.id) {
        if (!conflict && (await syncDraft())) synced++;
        continue;
      }
      if (cached.remoteConflict) {
        conflicts++;
        continue;
      }
      const payload = structuredClone(cached);
      payload.request ||= {
        id: crypto.randomUUID(),
        body: { ...payload, expectedRevision: payload.revision },
      };
      let rows = local();
      rows[payload.id] = payload;
      write(key(), rows);
      try {
        const r = await api("drafts", payload.request.body, payload.request.id);
        rows = local();
        rows[payload.id] = { ...r.draft, pending: false };
        write(key(), rows);
        synced++;
      } catch (e) {
        if (e.status === 409 && e.remote) {
          rows = local();
          rows[payload.id] = { ...payload, remoteConflict: e.remote };
          write(key(), rows);
          conflicts++;
          continue;
        }
        throw e;
      }
    }
    if ($("#queuestatus"))
      $("#queuestatus").textContent =
        `同步成功 ${synced} 份 · 需要人工解决冲突 ${conflicts} 份`;
    await refresh(route() === "desk");
  } catch (e) {
    toast("同步尚未完成；本机队列保留。" + (e.message || ""));
  } finally {
    queueBusy = false;
  }
}
function bindWorkspace() {
  $("[data-queue]")?.addEventListener("click", syncQueue);
  $("#quickform")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = $("#quicknote").value.trim();
    if (!text) return;
    current = {
      id: crypto.randomUUID(),
      revision: 0,
      scope: who.scope,
      title: text.slice(0, 100),
      body: text,
      summary: "",
      materialNotes: "",
      ...dates(),
      updatedAt: new Date().toISOString(),
      sourceDevice: innerWidth < 650 ? "手机浏览器" : "桌面浏览器",
      pending: true,
    };
    saveLocal();
    const saved = await syncDraft();
    $("#quicknote") && ($("#quicknote").value = "");
    if (saved) toast("私人草稿已同步，尚未公开");
    await refresh(false);
    if (route() === "desk") render();
  });
  document
    .querySelectorAll("[data-workspace]")
    .forEach((b) => (b.onclick = () => workspaceEditor(b.dataset.workspace)));
  document.querySelectorAll("[data-course-material]").forEach(
    (b) =>
      (b.onclick = () => {
        const c = workspace.courses.find(
          (c) => c.id === b.dataset.courseMaterial,
        );
        modal(
          `<div class="eyebrow">课前资料 / 手动录入</div><h2>${esc(c.title)}</h2><p>${esc(c.materialNotes || "尚未填写资料描述")}</p><p class="note">这里只同步文件名和说明，未上传原文件。请从已有授权资料库取用。</p><button data-close>已查看</button>`,
        );
      }),
  );
  document.querySelectorAll("[data-taskdone]").forEach(
    (b) =>
      (b.onclick = async () => {
        const t = workspace.tasks.find((t) => t.id === b.dataset.taskdone);
        try {
          await api("workspace", {
            ...t,
            kind: "task",
            expectedRevision: t.revision,
            status: "done",
          });
          await refresh(true);
        } catch (e) {
          toast(e.message);
        }
      }),
  );
  $("[data-importcourses]")?.addEventListener("click", () => {
    modal(
      '<h2>导入一节虚构示例课程</h2><p>这会在你的私人工作区建立“实验课准备”，时间为30分钟后，并附一份材料描述。不是读取学校教务。</p><div class="actions"><button id="importconfirm">确认导入示例</button><button data-close>取消</button></div>',
    );
    $("#importconfirm").onclick = async () => {
      try {
        await api("workspace", {
          kind: "course",
          title: "实验课准备",
          scope: who.scope,
          startsAt: new Date(Date.now() + 1800000).toISOString(),
          period: "示例第一节",
          materialNotes:
            "实验记录纸.pdf · 从授权资料库获取原文件\n器材检查表 · 核对两套备用器材",
        });
        $("#modal").close();
        await refresh(true);
      } catch (e) {
        toast(e.message);
      }
    };
  });
}
function workspaceEditor(kind) {
  modal(
    `<h2>${kind === "course" ? "手动录入虚构课程" : "添加私人待办"}</h2><form id="workspaceform" class="editor"><label>标题<input id="wtitle" required maxlength="100"></label><label>授权班级<select id="wscope">${(who.scopes || [who.scope]).map((s) => `<option>${esc(s)}</option>`).join("")}</select></label><label>日期和时间<input id="wdate" type="datetime-local" value="${toLocal(new Date(Date.now() + 1800000))}" required></label><label>节次 / 备注<input id="wperiod" maxlength="30"></label><label>资料名称与描述（原文件未上传）<textarea id="wmaterial" maxlength="1500"></textarea></label><div class="actions"><button class="primary">保存到私人工作区</button><button type="button" data-close>取消</button></div></form>`,
  );
  $("#workspaceform").onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api("workspace", {
        kind,
        title: $("#wtitle").value,
        scope: $("#wscope").value,
        startsAt: new Date($("#wdate").value).toISOString(),
        period: $("#wperiod").value,
        materialNotes: $("#wmaterial").value,
      });
      $("#modal").close();
      await refresh(true);
    } catch (e) {
      toast(e.message);
    }
  };
}

window.addEventListener("hashchange", render);
window.addEventListener("online", async () => {
  await refresh();
  await syncQueue();
  await refreshFeed();
});
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    command();
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && $("#editor")) {
    e.preventDefault();
    collect();
    syncDraft();
  }
});
setInterval(() => {
  if (document.hidden) return;
  if (who?.role === "teacher")
    refresh(
      route() === "desk" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(
          document.activeElement?.tagName,
        ),
    );
  else refreshFeed();
}, 2500);
setInterval(paintFeed, 1000);
setInterval(() => {
  if (!document.hidden) syncQueue();
}, 15000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    refresh();
    refreshFeed();
  }
});
if (pilot) {
  try {
    const session = await api("me");
    who = session.identity;
    write("haiz.flow.identity", who, sessionStorage);
  } catch (e) {
    if (e.status === 401) who = null;
  }
}
render();
if (who) {
  refresh(true);
  refreshFeed();
}
if ("serviceWorker" in navigator)
  navigator.serviceWorker.register("./sw.js").catch(() => {});
if (window.visualViewport) {
  const adaptKeyboard = () =>
    document.body.classList.toggle(
      "keyboard-open",
      innerHeight - visualViewport.height > 150,
    );
  visualViewport.addEventListener("resize", adaptKeyboard);
  adaptKeyboard();
}
