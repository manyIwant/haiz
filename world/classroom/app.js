import { SUBJECTS, schoolDate } from "../homework-core.js";
const $ = (s) => document.querySelector(s),
  esc = (v) =>
    String(v ?? "").replace(
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
let who = null,
  snapshot = null,
  devices = [],
  lastSync = "",
  busy = false,
  hidden = false,
  polling = false,
  edit = null,
  pending = null,
  listSignature = "",
  devicesCheckedAt = -Infinity,
  devicesCheckedWall = 0,
  syncFailureActive = false,
  writeEpoch = 0;
const filters = { scope: "all", date: schoolDate(), status: "active" };
const key = () => `haiz.pilot.assignment.draft.${who?.name}`;
function toast(text) {
  $("#message").textContent = text;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => ($("#message").textContent = ""), 6000);
}
async function api(path, body, requestId) {
  const actor = who?.name;
  const r = await fetch("/api/classroom/" + path, {
    method: body ? "POST" : "GET",
    headers: body
      ? {
          "Content-Type": "application/json",
          "Idempotency-Key": requestId || crypto.randomUUID(),
          "X-Haiz-Actor": who?.name || "",
        }
      : {},
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  const value = await r.json();
  if (!r.ok) {
    if (r.status === 401) invalidate();
    throw Object.assign(Error(value.error || "请求失败"), { status: r.status });
  }
  if (!who || who.name !== actor)
    throw Object.assign(Error("身份已改变，请重新进入班级作业"), {
      status: 409,
    });
  return value;
}
function invalidate(reason = "当前会话已过期或撤销，公开缓存已收起。") {
  snapshot = null;
  devices = [];
  devicesCheckedAt = -Infinity;
  who = null;
  document.querySelectorAll("dialog").forEach((d) => d.close());
  $("#identity").textContent = "会话已失效";
  $("#main").innerHTML =
    "<h1>请重新进入工作台</h1><p>" +
    esc(reason) +
    '</p><a href="/world/flow/">使用试用邀请登录，再选择“班级作业”</a>';
  $("#main").setAttribute("aria-busy", "false");
}
const isTeacher = () => ["teacher", "admin"].includes(who?.role);
function draft() {
  try {
    const d = JSON.parse(sessionStorage.getItem(key()));
    return d && d.owner === who.name ? d : null;
  } catch {
    return null;
  }
}
function collect() {
  const f = $("#assignment-form");
  if (!f) return null;
  return {
    ...Object.fromEntries(new FormData(f)),
    ...(edit ? { id: edit.id, version: edit.version } : {}),
  };
}
function saveDraft() {
  if (!who || !$("#assignment-form")) return;
  try {
    sessionStorage.setItem(
      key(),
      JSON.stringify({ ...draft(), owner: who.name, input: collect(), edit }),
    );
    $("#draft-state").textContent = "已保存到当前浏览器会话，尚未发布";
  } catch {
    $("#draft-state").textContent = "会话保存受限，请复制内容后再离开";
  }
}
function card(n) {
  const own = who.role === "admin" || n.actor === who.name;
  return `<article class="assignment" data-id="${esc(n.id)}"><h2>${esc(n.subject)}</h2><p>${esc(n.content)}</p><dl>${n.materials ? "<dt>准备</dt><dd>" + esc(n.materials) + "</dd>" : ""}${n.due ? "<dt>交付</dt><dd>" + esc(n.due) + "</dd>" : ""}</dl><small>${esc(n.scope)} · ${esc(n.studyDate)} · v${n.version} · ${n.status === "withdrawn" ? "已撤回" : n.review === "pending" ? "待审核" : "公开"}</small>${isTeacher() && own ? `<div class="actions"><button data-edit="${esc(n.id)}">修改</button>${n.review === "pending" && who.role === "admin" ? `<button data-operation="approve" data-id="${esc(n.id)}">审核通过</button>` : ""}${n.status !== "withdrawn" ? `<button data-operation="withdraw" data-id="${esc(n.id)}">撤回</button>` : ""}</div>` : ""}</article>`;
}
function currentRows() {
  if (!snapshot || snapshot.schoolDate !== schoolDate()) return [];
  return snapshot.assignments.filter(
    (n) =>
      n.studyDate === schoolDate() &&
      n.status === "published" &&
      n.review === "approved",
  );
}
function filteredRows() {
  return snapshot.assignments.filter(
    (n) =>
      (filters.scope === "all" || n.scope === filters.scope) &&
      n.studyDate === filters.date &&
      (filters.status === "all" ||
        (filters.status === "withdrawn" && n.status === "withdrawn") ||
        (filters.status === "pending" &&
          n.status === "published" &&
          n.review === "pending") ||
        (filters.status === "active" && n.status === "published")),
  );
}
function setFilters(next) {
  Object.assign(filters, next);
  for (const name of ["scope", "date", "status"]) {
    const control = $("#filter-" + name);
    if (control) control.value = filters[name];
  }
  updateLists();
}
function renderDevices() {
  if (!isTeacher() || !$("#devices")) return;
  const age = Math.max(
    0,
    performance.now() - devicesCheckedAt,
    Date.now() - devicesCheckedWall,
  );
  $("#devices").innerHTML = devices.length
    ? devices
        .map((d) => {
          const fresh =
            d.fresh && Number.isFinite(d.freshForMs) && age < d.freshForMs;
          return `<div class="device" data-fresh="${fresh}"><strong>${esc(d.scope)} · ${esc(d.account)} 试用会话</strong><span>${fresh ? { received: "客户端已接收", rendered: "客户端报告已呈现", suppressed: "客户端已隐藏" }[d.state] || "未确认" : "当前版本接收状态已过期或未确认"}</span><small>${d.at ? "最近报告 " + new Date(d.at).toLocaleTimeString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false }) : "尚无回执"} · ${{ "manual-hidden": "手动隐藏", "document-hidden": "页面不在前台", "clock-mismatch": "设备日期需核对" }[d.reason] || ""} · ${d.itemCount ?? 0} 项今日作业 · 不代表学生已阅读</small></div>`;
        })
        .join("")
    : '<p class="muted">当前没有已登录的授权教室会话；未确认送达。</p>';
}
function updateLists() {
  if (!who || !snapshot) return;
  const rows = isTeacher() ? filteredRows() : currentRows();
  const wrongDate = !isTeacher() && snapshot.schoolDate !== schoolDate();
  const signature = JSON.stringify([
    rows,
    hidden,
    who.name,
    wrongDate,
    isTeacher() ? filters : null,
  ]);
  if (signature !== listSignature) {
    $("#assignment-list").innerHTML = hidden
      ? '<div class="status">已手动隐藏。恢复前不会自动展示。</div>'
      : wrongDate
        ? '<div class="status">设备日期与学校数据不一致，已收起清单。请核对设备时间后刷新。</div>'
        : rows.map(card).join("") ||
          (isTeacher()
            ? '<div class="status">所选班级、日期或状态没有匹配的作业。可切换筛选查看其他已同步记录；筛选不会修改草稿。</div>'
            : "") ||
          '<div class="status">当前没有可显示的作业。未同步或断网时，空清单不代表没有作业；请以教师说明为准。</div>';
    listSignature = signature;
  }
  $("#count").textContent = (hidden ? 0 : rows.length) + " 项";
  $("#sync").textContent = lastSync
    ? "最近有效同步 " +
      new Date(lastSync).toLocaleTimeString("zh-CN", {
        timeZone: "Asia/Shanghai",
        hour12: false,
      })
    : "尚未同步";
  if (isTeacher()) {
    $("#list-summary").textContent =
      filters.date +
      " · " +
      (filters.scope === "all" ? "全部授权班级" : filters.scope) +
      " · " +
      rows.length +
      " 项匹配 / " +
      snapshot.assignments.length +
      " 项已同步";
    renderDevices();
  }
}
function fill(input) {
  const f = $("#assignment-form");
  for (const [name, value] of Object.entries(input || {})) {
    const control = f?.elements.namedItem(name);
    if (control && typeof value === "string") control.value = value;
  }
  if ($("#form-title"))
    $("#form-title").textContent = edit
      ? "修改作业 · v" + edit.version
      : "布置作业";
}
function build() {
  if (!who) return;
  $("#identity").textContent = who.name + " · " + who.scope + " · 虚构试用";
  listSignature = "";
  $("#main").className = who.role === "display" ? "screen" : "";
  $("#main").setAttribute("aria-busy", "false");
  $("#main").innerHTML =
    `<h1>${isTeacher() ? "班级作业工作台" : "今日班级作业"}</h1><div class="summary"><b id="count"></b><span id="sync"></span>${who.role === "display" ? '<button id="hide">隐藏清单</button>' : ""}</div><p class="muted">${who.role === "display" ? "课表尚未连接，当前由教师手动展示。" : "与通知工作台共用本次授权会话，无需重新输入凭据。"}</p>${isTeacher() ? '<nav class="workbench-jumps" aria-label="工作台区域"><a href="#assignment-form">填写作业</a><a href="#list-controls">筛选与清单</a><a href="#devices-section">接收状态</a></nav>' : ""}<div class="grid">${isTeacher() ? `<section><form id="assignment-form"><h2 id="form-title">布置作业</h2><div class="columns"><label>授权班级<select name="scope">${snapshot.scopes.map((s) => `<option>${esc(s)}</option>`).join("")}</select></label><label>学科<select name="subject">${SUBJECTS.map((s) => `<option>${s}</option>`).join("")}</select></label></div><label>展示日期<input name="studyDate" type="date" value="${schoolDate()}" required></label><label>公开要求<textarea name="content" maxlength="400" required placeholder="写清题目、范围和要求；勿输入学生个人信息"></textarea></label><label>需要准备<input name="materials" maxlength="100"></label><label>交付说明<input name="due" maxlength="100"></label><p id="draft-state" class="muted" role="status">只在当前可信浏览器会话保存草稿；退出前请完成或复制。</p><div class="actions"><button class="primary" type="submit">预览作业</button><button type="button" id="cancel-edit">新建作业</button></div></form></section>` : ""}<section>${isTeacher() ? '<section id="devices-section" class="status"><h2>今日清单接收状态</h2><p class="muted">只确认当天有效公开内容，不含待审、撤回或未来日期作业。</p><div id="devices"></div></section>' : ""}<h2>作业清单</h2>${isTeacher() ? `<div id="list-controls" class="list-filters" aria-label="作业清单筛选"><label>查看班级<select id="filter-scope"><option value="all">全部授权班级</option>${snapshot.scopes.map((s) => `<option>${esc(s)}</option>`).join("")}</select></label><label>查看日期<input id="filter-date" type="date" value="${filters.date}"></label><label>查看状态<select id="filter-status"><option value="active">有效与待审</option><option value="pending">待审核</option><option value="withdrawn">已撤回</option><option value="all">所有状态</option></select></label><button id="filter-today">查看今天</button><button id="filter-reset">重置筛选</button></div><p id="list-summary" class="muted" role="status"></p><p class="muted">筛选只改变清单，不会改变左侧草稿的发布班级和日期。</p>` : ""}<div id="assignment-list" class="cards"></div></section></div>`;
  if (!isTeacher()) $("#main .grid").classList.remove("grid");
  const saved = draft();
  if (isTeacher() && saved?.input) {
    const row =
      saved.edit && snapshot.assignments.find((n) => n.id === saved.edit.id);
    if (!saved.edit || row?.version === saved.edit.version) {
      edit = saved.edit || null;
      fill(saved.input);
      $("#draft-state").textContent =
        "已恢复当前会话草稿，请核对班级和展示日期";
    } else
      $("#draft-state").textContent =
        "服务端已有新版本，旧草稿仍保留，未自动覆盖";
  }
  for (const name of ["scope", "date", "status"]) {
    const control = $("#filter-" + name);
    if (control) control.value = filters[name];
  }
  updateLists();
}
async function report(state, reason) {
  if (who?.role !== "display" || !snapshot?.receiptToken) return;
  await api("receipt", { token: snapshot.receiptToken, state, reason });
}
async function acknowledge() {
  if (who?.role !== "display") return;
  await report("received");
  if (snapshot.schoolDate !== schoolDate()) {
    await report("suppressed", "clock-mismatch");
    return;
  }
  if (hidden || document.hidden) {
    await report("suppressed", hidden ? "manual-hidden" : "document-hidden");
    return;
  }
  await new Promise((r) =>
    requestAnimationFrame(() => requestAnimationFrame(r)),
  );
  if (who && snapshot && !hidden && !document.hidden) await report("rendered");
}
async function sync() {
  if (polling || !who) return;
  polling = true;
  const epoch = writeEpoch;
  try {
    const next = await api("assignments");
    if (!who) return;
    if (next.identity.name !== who.name) {
      invalidate(
        "会话身份已改变。请重新进入；原身份草稿仍保留在当前浏览器会话。",
      );
      return;
    }
    if (epoch !== writeEpoch) return;
    snapshot = next;
    lastSync = next.serverTime;
    if (isTeacher()) {
      const checkedAt = performance.now(),
        checkedWall = Date.now();
      const status = await api("deliveries");
      if (epoch !== writeEpoch) return;
      devices = status.devices;
      devicesCheckedAt = checkedAt;
      devicesCheckedWall = checkedWall;
    }
    if (!$("#assignment-list")) build();
    else updateLists();
    $("#refresh").textContent = "刷新清单";
    if (syncFailureActive) {
      syncFailureActive = false;
      clearTimeout(toast.timer);
      $("#message").textContent = "";
    }
    await acknowledge();
  } catch (e) {
    if (epoch !== writeEpoch) return;
    if (who) {
      $("#refresh").textContent = "连接中断 · 点击重试";
      if (snapshot && $("#assignment-list")) updateLists();
      if (!snapshot) {
        $("#main").setAttribute("aria-busy", "false");
        $("#main").innerHTML =
          "<h1>暂时无法读取班级清单</h1><p>点击上方刷新清单重试；不要据此判断今天没有作业。</p>";
      }
      if (e.status !== 409 && !syncFailureActive) {
        syncFailureActive = true;
        toast(
          e.status
            ? e.message
            : "连接中断，当前显示最后一次有效清单；恢复网络后可刷新。",
        );
      }
    }
  } finally {
    polling = false;
    if (who && epoch !== writeEpoch) queueMicrotask(sync);
  }
}
function preview() {
  if (document.querySelector("dialog[open]")) return;
  document.querySelectorAll("dialog").forEach((d) => d.remove());
  const input = collect();
  if (!input || !snapshot.scopes.includes(input.scope))
    throw Error("请选择授权班级");
  saveDraft();
  const d = document.createElement("dialog");
  d.innerHTML = `<h2>确认公开作业</h2><p>${esc(input.scope)} · ${esc(input.studyDate)} · ${esc(input.subject)}</p><p>${esc(input.content)}</p><p>准备：${esc(input.materials || "无")}<br>交付：${esc(input.due || "未填写")}</p><p class="muted">只进入授权班级公共清单；保存成功不等于教室已经显示。</p><div class="actions"><button data-back>返回修改</button><button data-publish class="primary">确认发布</button><button data-review>送管理员审核</button></div>`;
  document.body.append(d);
  d.showModal();
  d.addEventListener("close", () => d.remove(), { once: true });
  d.querySelector("[data-back]").onclick = () => d.close();
  for (const button of d.querySelectorAll("[data-publish],[data-review]"))
    button.onclick = () =>
      publish(
        { ...input, submitForReview: button.hasAttribute("data-review") },
        d,
      );
}
async function publish(input, dialog) {
  if (busy) return;
  busy = true;
  const fingerprint = JSON.stringify(input),
    saved = draft();
  pending =
    pending?.fingerprint === fingerprint
      ? pending
      : saved?.fingerprint === fingerprint
        ? saved
        : { fingerprint, requestId: crypto.randomUUID() };
  try {
    sessionStorage.setItem(
      key(),
      JSON.stringify({
        ...saved,
        owner: who.name,
        input: collect(),
        edit,
        ...pending,
      }),
    );
  } catch {}
  dialog.querySelectorAll("button").forEach((b) => (b.disabled = true));
  $("#assignment-form").inert = true;
  try {
    await api("assignments", input, pending.requestId);
    writeEpoch++;
    devicesCheckedAt = -Infinity;
    try {
      sessionStorage.removeItem(key());
    } catch {}
    edit = null;
    pending = null;
    $("#assignment-form").reset();
    $("#assignment-form [name=studyDate]").value = schoolDate();
    $("#form-title").textContent = "布置作业";
    $("#draft-state").textContent = "已保存；当前工作草稿已清除";
    dialog.close();
    setFilters({
      scope: input.scope,
      date: input.studyDate,
      status: input.submitForReview ? "pending" : "active",
    });
    toast(
      "服务端已保存，清单已切换到这次发布的班级和日期；请查看今日接收状态。",
    );
    await sync();
  } catch (e) {
    toast(
      e.status
        ? e.message
        : "保存结果未确认。草稿已保留，恢复连接后用同一预览重试。",
    );
  } finally {
    busy = false;
    if ($("#assignment-form")) $("#assignment-form").inert = false;
    if (dialog.isConnected)
      dialog.querySelectorAll("button").forEach((b) => (b.disabled = false));
  }
}
document.addEventListener("input", (e) => {
  if (e.target.closest("#assignment-form")) saveDraft();
});
document.addEventListener("change", (e) => {
  const name = e.target.id?.replace("filter-", "");
  if (!isTeacher() || !["scope", "date", "status"].includes(name)) return;
  const value = e.target.value;
  if (name === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
  if (name === "scope" && value !== "all" && !snapshot.scopes.includes(value))
    return;
  if (
    name === "status" &&
    !["active", "pending", "withdrawn", "all"].includes(value)
  )
    return;
  setFilters({ [name]: value });
});
document.addEventListener("submit", (e) => {
  if (e.target.id === "assignment-form") {
    e.preventDefault();
    try {
      preview();
    } catch (error) {
      toast(error.message);
    }
  }
});
document.addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b || busy) return;
  try {
    if (b.id === "refresh") return sync();
    if (b.id === "filter-today")
      return setFilters({ date: schoolDate(), status: "active" });
    if (b.id === "filter-reset")
      return setFilters({ scope: "all", date: schoolDate(), status: "active" });
    if (b.id === "hide") {
      hidden = !hidden;
      b.textContent = hidden ? "恢复清单" : "隐藏清单";
      updateLists();
      return await acknowledge();
    }
    if (b.id === "cancel-edit") {
      if (
        collect()?.content.trim() &&
        !confirm("放弃当前未发布内容并新建作业？")
      )
        return;
      edit = null;
      pending = null;
      $("#assignment-form").reset();
      $("#assignment-form [name=studyDate]").value = schoolDate();
      $("#form-title").textContent = "布置作业";
      saveDraft();
      return;
    }
    if (b.dataset.edit) {
      if (
        collect()?.content.trim() &&
        !confirm("切换编辑将替换当前工作草稿，是否继续？")
      )
        return;
      const n = snapshot.assignments.find((n) => n.id === b.dataset.edit);
      edit = { id: n.id, version: n.version };
      fill(n);
      saveDraft();
      $("#assignment-form textarea").focus();
      return;
    }
    if (b.dataset.operation) {
      const n = snapshot.assignments.find((n) => n.id === b.dataset.id);
      if (
        !confirm(
          b.dataset.operation === "withdraw"
            ? "撤回后，已联网的教室会在下一次同步收起；离线教室暂未确认。"
            : "审核通过并加入公开清单？",
        )
      )
        return;
      busy = true;
      b.disabled = true;
      try {
        await api("assignment-action", {
          id: n.id,
          version: n.version,
          operation: b.dataset.operation,
        });
        writeEpoch++;
        devicesCheckedAt = -Infinity;
        renderDevices();
        await sync();
      } finally {
        busy = false;
        if (b.isConnected) b.disabled = false;
      }
    }
  } catch (error) {
    toast(error.message);
  }
});
document.addEventListener("visibilitychange", () => {
  if (who?.role === "display" && document.hidden)
    report("suppressed", "document-hidden").catch(() => {});
  if (!document.hidden) {
    devicesCheckedAt = -Infinity;
    if ($("#assignment-list")) updateLists();
    sync();
  }
});
setInterval(() => {
  if (who && !document.hidden) sync();
}, 10000);
setInterval(() => {
  if (isTeacher() && !document.hidden) renderDevices();
  if (
    who &&
    !isTeacher() &&
    snapshot?.schoolDate !== schoolDate() &&
    $("#assignment-list")
  )
    updateLists();
}, 1000);
try {
  const r = await fetch("/api/flow/me", { cache: "no-store" });
  if (!r.ok) invalidate();
  else {
    who = (await r.json()).identity;
    await sync();
  }
} catch {
  invalidate();
}
