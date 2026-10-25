import { existsSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { assignmentCommand } from "./assignments.mjs";
import { schoolDate, todayAssignments } from "../homework-core.js";
const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
export function createClassroomStore(
  file,
  { now = () => Date.now(), scopes = [] } = {},
) {
  let state = {
    format: "haiz-classroom-pilot-v1",
    revision: 0,
    assignments: [],
    requests: {},
    audit: [],
    deliveries: {},
  };
  if (existsSync(file)) {
    state = JSON.parse(readFileSync(file, "utf8"));
    if (
      state.format !== "haiz-classroom-pilot-v1" ||
      !Array.isArray(state.assignments) ||
      !state.requests ||
      !state.deliveries ||
      !Number.isInteger(state.revision)
    )
      throw Error("公共作业数据格式无效，未覆盖原文件");
  }
  const secret = randomBytes(32),
    generation = randomBytes(12).toString("hex");
  let sequence = 0;
  const commit = (next) => {
    writeFileSync(file + ".tmp", JSON.stringify(next), { mode: 0o600 });
    renameSync(file + ".tmp", file);
    state = next;
  };
  const permitted = (who, scope) =>
    scopes.includes(scope) &&
    (who.role === "admin" || (who.scopes || [who.scope]).includes(scope));
  const publicRows = (scope) =>
    todayAssignments(state.assignments, scope, now()).map(
      ({ actor, ...row }) => row,
    );
  const digest = (rows) =>
    createHash("sha256")
      .update(JSON.stringify(rows.map((n) => [n.id, n.version])))
      .digest("hex");
  const sign = (text) =>
    createHmac("sha256", secret).update(text).digest("base64url");
  function snapshot(who, sessionId) {
    if (!["teacher", "admin", "student", "display"].includes(who.role))
      fail(403, "当前身份不可读取清单");
    const allowed = scopes.filter((s) => permitted(who, s));
    const assignments = ["display", "student"].includes(who.role)
      ? publicRows(who.scope)
      : state.assignments.filter((n) => allowed.includes(n.scope));
    const result = {
      format: "haiz-classroom-pilot-v1",
      demo: true,
      revision: state.revision,
      serverTime: new Date(now()).toISOString(),
      schoolDate: schoolDate(now()),
      identity: who,
      scopes: allowed,
      assignments,
      bridge: { available: false, label: "未连接ClassIsland；本页仅手动展示" },
    };
    if (who.role === "display") {
      const payload = Buffer.from(
        JSON.stringify({
          sessionId,
          scope: who.scope,
          revision: state.revision,
          date: schoolDate(now()),
          digest: digest(assignments),
          expires: now() + 90000,
          issued: now(),
          sequence: ++sequence,
          generation,
        }),
      ).toString("base64url");
      result.receiptToken = payload + "." + sign(payload);
    }
    return result;
  }
  function command(who, input, operation, requestId) {
    const output = assignmentCommand(state, input, {
      who,
      operation,
      requestId,
      requiredKey: true,
      allowedScopes: scopes,
      now: now(),
    });
    if (!output.result.replayed) commit(output.state);
    return output.result;
  }
  function receipt(who, sessionId, input, activeSessionIds = [sessionId]) {
    if (who.role !== "display") fail(403, "只有教室只读身份可报告客户端状态");
    if (!["received", "rendered", "suppressed"].includes(input?.state))
      fail(400, "回执状态无效");
    if (typeof input.token !== "string" || input.token.length > 3000)
      fail(400, "缺少清单回执凭据");
    const [payload, signature, ...extra] = input.token.split("."),
      expected = sign(payload || "");
    if (
      extra.length ||
      !signature ||
      Buffer.byteLength(signature) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    )
      fail(403, "回执凭据无效");
    let proof;
    try {
      proof = JSON.parse(Buffer.from(payload, "base64url").toString());
    } catch {
      fail(400, "回执凭据格式无效");
    }
    if (proof.sessionId !== sessionId || proof.scope !== who.scope)
      fail(403, "回执不属于当前教室会话");
    if (
      proof.expires <= now() ||
      proof.issued > now() ||
      proof.revision !== state.revision ||
      proof.date !== schoolDate(now()) ||
      proof.digest !== digest(publicRows(who.scope))
    )
      fail(409, "清单已变化或凭据过期，请重新同步");
    const prior = state.deliveries[sessionId];
    if (
      prior?.generation === generation &&
      (prior.sequence > proof.sequence ||
        (prior.sequence === proof.sequence &&
          prior.state !== "received" &&
          input.state === "received"))
    )
      return { ok: true, ignored: true };
    const delivery = {
      sessionId,
      account: who.name,
      scope: who.scope,
      revision: proof.revision,
      digest: proof.digest,
      itemCount: publicRows(who.scope).length,
      date: proof.date,
      state: input.state,
      reason:
        input.state === "suppressed"
          ? ["manual-hidden", "clock-mismatch"].includes(input.reason)
            ? input.reason
            : "document-hidden"
          : "",
      at: new Date(now()).toISOString(),
      generation,
      sequence: proof.sequence,
    };
    // Bounded pilot sessions; receipts contain no student identity or behavior.
    commit({
      ...state,
      deliveries: {
        ...Object.fromEntries(
          Object.entries(state.deliveries).filter(([id]) =>
            activeSessionIds.includes(id),
          ),
        ),
        [sessionId]: delivery,
      },
    });
    return { ok: true };
  }
  function deliveries(who, activeSessions) {
    if (!["teacher", "admin"].includes(who.role))
      fail(403, "当前身份不可查看设备会话状态");
    return {
      serverTime: new Date(now()).toISOString(),
      revision: state.revision,
      devices: activeSessions
        .filter((s) => s.role === "display" && permitted(who, s.scope))
        .map((s) => {
          const row = state.deliveries[s.id];
          const {
            generation: _,
            sequence: __,
            digest: ___,
            ...publicRow
          } = row || {};
          return {
            sessionId: s.id,
            account: s.account,
            scope: s.scope,
            ...publicRow,
            fresh:
              !!row &&
              row.revision === state.revision &&
              row.digest === digest(publicRows(s.scope)) &&
              row.date === schoolDate(now()) &&
              now() - Date.parse(row.at) >= 0 &&
              now() - Date.parse(row.at) < 90000,
          };
        }),
      meaning: "客户端状态报告，不代表学生已阅读；未绑定真实教学设备",
    };
  }
  return { snapshot, command, receipt, deliveries };
}
