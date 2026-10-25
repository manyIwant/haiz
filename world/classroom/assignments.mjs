// Shared assignment command rules for localhost and the authenticated HTTPS pilot.
import { createHash } from "node:crypto";
import { upsertAssignment, assignmentAction } from "../homework-core.js";
const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
export function assignmentCommand(
  state,
  input,
  {
    who,
    operation = "upsert",
    requestId,
    requiredKey = false,
    allowedScopes,
    now = Date.now(),
  },
) {
  if (!["teacher", "admin"].includes(who.role))
    fail(403, "当前身份不能发布或修改作业");
  if (!input || typeof input !== "object" || Array.isArray(input))
    fail(400, "作业请求必须为对象");
  if (!["upsert", "action"].includes(operation)) fail(400, "不支持的作业操作");
  if (
    (requiredKey && !requestId) ||
    (requestId !== undefined &&
      (typeof requestId !== "string" ||
        !/^[A-Za-z0-9_-]{8,100}$/.test(requestId)))
  )
    fail(400, "发布请求标识无效");
  const endpoint =
    operation === "upsert" ? "/api/assignments" : "/api/assignment-action";
  const key = requestId
    ? createHash("sha256")
        .update(JSON.stringify([who.name, endpoint, requestId]))
        .digest("hex")
    : null;
  const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const previous = key && state.requests[key];
  const scopes = who.scopes || [who.scope],
    admin = who.role === "admin";
  const old = input.id && state.assignments.find((n) => n.id === input.id);
  // Recheck present authorization even on replay; a prior receipt grants no new permission.
  if (old && !admin && (!scopes.includes(old.scope) || old.actor !== who.name))
    fail(403, "无权修改此作业");
  if (
    operation === "upsert" &&
    ((!admin && !scopes.includes(input.scope)) ||
      (allowedScopes && !allowedScopes.includes(input.scope)))
  )
    fail(403, "凭据不允许向此班发布作业");
  if (operation === "action" && input.operation === "approve" && !admin)
    fail(403, "待审作业需要管理员审核");
  if (previous) {
    if (previous.hash !== hash) fail(409, "同一发布请求内容已改变，请重新预览");
    return { state, result: { ...previous.result, replayed: true } };
  }
  if (key && Object.keys(state.requests).length >= 5000)
    fail(503, "演示发布记录容量已满，请管理员备份处理；未丢弃已有内容");
  if (input.id && !old) fail(404, "作业不存在");
  if (old && Number(input.version) !== old.version)
    fail(409, "作业已有新版本，请刷新后重试");
  const scope = operation === "upsert" ? input.scope : old?.scope;
  const policy = { scope, actor: who.name, admin };
  let assignments;
  try {
    assignments =
      operation === "upsert"
        ? upsertAssignment(state.assignments, input, policy, now)
        : assignmentAction(state.assignments, input, policy, now);
  } catch (e) {
    fail(400, e.message);
  }
  const item = input.id
    ? assignments.find((n) => n.id === input.id)
    : assignments[0];
  const result = {
    revision: state.revision + 1,
    id: item.id,
    version: item.version,
    review: item.review,
  };
  return {
    state: {
      ...state,
      assignments,
      revision: result.revision,
      requests: key
        ? { ...state.requests, [key]: { hash, result } }
        : state.requests,
      audit: [
        ...state.audit,
        {
          actor: who.name,
          role: who.role,
          at: new Date(now).toISOString(),
          message:
            operation === "upsert"
              ? "发布或修改班级作业"
              : "审核或撤回班级作业",
        },
      ].slice(-200),
    },
    result,
  };
}
