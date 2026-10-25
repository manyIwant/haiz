// Separate fictional-data pilot. Never expose classroom-server's repository file service.
import http from "node:http";
import https from "node:https";
import { randomBytes, createHash, randomUUID } from "node:crypto";
import {
  readFileSync,
  writeFileSync,
  renameSync,
  mkdirSync,
  existsSync,
  unlinkSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {createClassroomStore} from "../classroom/store.mjs";
import { createFlowStore } from "../flow/store.mjs";
const ROOT = fileURLToPath(new URL("../", import.meta.url));
const hash = (s) => createHash("sha256").update(s).digest("hex");
const fail = (status, message) => Object.assign(new Error(message), { status });
const accounts = [
  {
    name: "teacher-a",
    role: "teacher",
    scope: "演示一班",
    scopes: ["演示一班", "演示二班"],
  },
  {
    name: "teacher-b",
    role: "teacher",
    scope: "演示三班",
    scopes: ["演示三班"],
  },
  { name: "student-a", role: "student", scope: "演示一班" },
  { name: "display-a", role: "display", scope: "演示一班" },
  { name: "display-b", role: "display", scope: "演示三班" },
  { name: "admin", role: "admin", scope: "管理" },
];
export function createPilotServer({
  directory = path.join(ROOT, "pilot/.data"),
  origin,
  tls = null,
  behindProxy = false,
  sessionMs = 8 * 3600000,
  inviteMs = 30 * 60000,
  rateLimit = 240,
  loginLimit = 12,
  now = () => Date.now(),
} = {}) {
  const publicURL = new URL(origin);
  if (
    publicURL.protocol !== "https:" ||
    publicURL.pathname !== "/" ||
    publicURL.username ||
    publicURL.password ||
    publicURL.search ||
    publicURL.hash
  )
    throw Error("PUBLIC_ORIGIN必须为独立HTTPS来源");
  if (!tls && !behindProxy) throw Error("必须配置TLS，或明确使用受控反向代理");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const stateFile = path.join(directory, "identities.json"),
    bootstrapFile = path.join(directory, "bootstrap-invite.txt"),
    flowFile = path.join(directory, "flow.json");
  let auth = existsSync(stateFile)
    ? JSON.parse(readFileSync(stateFile, "utf8"))
    : { sessions: [], invites: [], events: [] };
  const persist = () => {
    writeFileSync(stateFile + ".tmp", JSON.stringify(auth), { mode: 0o600 });
    renameSync(stateFile + ".tmp", stateFile);
  };
  const audit = (action, actor, target) => {
    auth.events.push({
      action,
      actor,
      target,
      at: new Date(now()).toISOString(),
    });
    auth.events = auth.events.slice(-500);
  };
  function issue(account) {
    if (!accounts.some((a) => a.name === account))
      throw fail(400, "演示身份不存在");
    auth.invites = auth.invites.filter((i) => i.expiresAt > now() && !i.used);
    if (auth.invites.length >= 24) throw fail(429, "最多24个待使用邀请");
    const invite = randomBytes(32).toString("base64url");
    auth.invites.push({
      id: randomUUID(),
      hash: hash(invite),
      account,
      expiresAt: now() + inviteMs,
      used: false,
    });
    persist();
    return { invite, expiresAt: now() + inviteMs, account };
  }
  if (!existsSync(stateFile)) {
    const bootstrap = issue("admin");
    writeFileSync(bootstrapFile, bootstrap.invite, { mode: 0o600 });
  }
  let flow = createFlowStore(
    flowFile,
    true,
    () => ({
      source: "simulator",
      available: false,
      current: "未连接",
      next: "未连接",
    }),
    { maxDrafts: 100, maxNotices: 200, maxRequests: 2000, maxAudit: 1000 },
  );
  const classroomFile=path.join(directory,"classroom.json");
  const classroomScopes=[...new Set(accounts.filter(a=>a.role!=="admin").flatMap(a=>a.scopes||[a.scope]))];
  let classroom=createClassroomStore(classroomFile,{now,scopes:classroomScopes});
  const buckets = new Map();
  function limit(key, max) {
    const t = now();
    if (buckets.size > 2000) {
      for (const [k, b] of buckets) if (t - b.since >= 60000) buckets.delete(k);
      if (buckets.size > 2000) throw fail(429, "服务繁忙，请稍后重试");
    }
    const b = buckets.get(key) || { since: t, count: 0 };
    if (t - b.since >= 60000) {
      b.since = t;
      b.count = 0;
    }
    b.count++;
    buckets.set(key, b);
    if (b.count > max) throw fail(429, "请求过于频繁，请一分钟后重试");
  }
  const reply = (res, status, value) => {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(value));
  };
  async function json(req) {
    if (!String(req.headers["content-type"]).startsWith("application/json"))
      throw fail(415, "只接受JSON");
    let raw = "";
    for await (const c of req) {
      raw += c;
      if (Buffer.byteLength(raw) > 12000) throw fail(413, "请求过大");
    }
    try {
      return JSON.parse(raw);
    } catch {
      throw fail(400, "JSON无效");
    }
  }
  const cookie = (value, seconds) =>
    `haiz_pilot=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${seconds}`;
  const handler = async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()",
    );
    res.setHeader("Strict-Transport-Security", "max-age=86400");
    const nonce = randomBytes(16).toString("base64");
    res.setHeader(
      "Content-Security-Policy",
      `default-src 'self'; script-src 'self' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`,
    );
    try {
      if (req.headers.host !== publicURL.host)
        throw fail(403, "来源主机不匹配");
      if (req.headers.origin && req.headers.origin !== publicURL.origin)
        throw fail(403, "拒绝跨来源请求");
      const url = new URL(req.url, publicURL);
      if (!["GET", "HEAD", "POST"].includes(req.method))
        throw fail(405, "方法不支持");
      if (req.method === "POST" && req.headers.origin !== publicURL.origin)
        throw fail(403, "修改操作必须带匹配Origin");
      const address = req.socket.remoteAddress;
      limit("all:" + address, rateLimit);
      if (url.pathname === "/api/flow/login" && req.method === "POST") {
        limit("login:" + address, loginLimit);
        const input = await json(req);
        if (input.fictionalOnly !== true)
          throw fail(400, "请先确认仅使用虚构数据和个人可信浏览器");
        const invitation = auth.invites.find(
          (i) =>
            i.hash === hash(String(input.invite || "")) &&
            !i.used &&
            i.expiresAt > now(),
        );
        if (!invitation) throw fail(401, "邀请码无效、已使用或已过期");
        const account = accounts.find((a) => a.name === invitation.account);
        auth.sessions = auth.sessions.filter(
          (s) => s.expiresAt > now() && !s.revoked,
        );
        if (auth.sessions.length >= 24) throw fail(429, "试用会话已达上限");
        const secret = randomBytes(32).toString("base64url");
        const session = {
          id: randomUUID(),
          hash: hash(secret),
          account: account.name,
          expiresAt: now() + sessionMs,
          createdAt: new Date(now()).toISOString(),
          revoked: false,
        };
        invitation.used = true;
        auth.sessions.push(session);
        audit("session_created", account.name, session.id);
        persist();
        if (account.role === "admin" && existsSync(bootstrapFile))
          unlinkSync(bootstrapFile);
        res.setHeader(
          "Set-Cookie",
          cookie(secret, Math.ceil(sessionMs / 1000)),
        );
        return reply(res, 200, {
          identity: account,
          expiresAt: session.expiresAt,
        });
      }
      if (url.pathname.startsWith("/api/")) {
        const rawCookie =
          String(req.headers.cookie || "")
            .split(";")
            .map((x) => x.trim())
            .find((x) => x.startsWith("haiz_pilot="))
            ?.slice(11) || "";
        const session = auth.sessions.find(
          (s) =>
            s.hash === hash(rawCookie) && !s.revoked && s.expiresAt > now(),
        );
        if (!session) throw fail(401, "会话已失效，请使用新的邀请重新进入");
        const who = accounts.find((a) => a.name === session.account);
        limit("session:" + session.id, 120);
        if (url.pathname === "/api/flow/logout" && req.method === "POST") {
          session.revoked = true;
          audit("session_revoked", who.name, session.id);
          persist();
          res.setHeader("Set-Cookie", cookie("", 0));
          return reply(res, 200, { ok: true });
        }
        if (url.pathname.startsWith("/api/flow/admin")) {
          if (who.role !== "admin") throw fail(403, "只有试用管理员可执行");
          if (url.pathname === "/api/flow/admin" && req.method === "GET")
            return reply(res, 200, {
              accounts,
              sessions: auth.sessions.map(
                ({ id, account, expiresAt, revoked, createdAt }) => ({
                  id,
                  account,
                  expiresAt,
                  revoked,
                  createdAt,
                }),
              ),
              events: auth.events.slice(-50),
              limits: {
                sessions: 24,
                drafts: 100,
                notices: 200,
                sessionHours: sessionMs / 3600000,
              },
              dataPolicy: "仅虚构数据；每次试用后清理",
            });
          const input = await json(req);
          if (url.pathname === "/api/flow/admin/invite") {
            const result = issue(input.account);
            audit("invite_created", who.name, input.account);
            persist();
            return reply(res, 200, result);
          }
          if (url.pathname === "/api/flow/admin/revoke") {
            const target = auth.sessions.find((s) => s.id === input.id);
            if (!target) throw fail(404, "会话不存在");
            target.revoked = true;
            audit("session_revoked", who.name, target.id);
            persist();
            return reply(res, 200, { ok: true });
          }
          if (url.pathname === "/api/flow/admin/reset") {
            if (input.confirm !== "清理虚构数据")
              throw fail(400, "请输入清理虚构数据");
            if (existsSync(flowFile)) unlinkSync(flowFile);
            flow = createFlowStore(flowFile, true, () => null, {
              maxDrafts: 100,
              maxNotices: 200,
              maxRequests: 2000,
              maxAudit: 1000,
            });
            if(existsSync(classroomFile))unlinkSync(classroomFile);
            classroom=createClassroomStore(classroomFile,{now,scopes:classroomScopes});
            auth.sessions.forEach((s) => {
              if (s.id !== session.id) s.revoked = true;
            });
            auth.invites = [];
            audit("pilot_reset", who.name, "all");
            persist();
            return reply(res, 200, { ok: true });
          }
          throw fail(404, "管理接口不存在");
        }
        if(url.pathname.startsWith("/api/classroom/")){
          if(url.pathname==="/api/classroom/assignments"&&req.method==="GET")return reply(res,200,classroom.snapshot(who,session.id));
          if(url.pathname==="/api/classroom/deliveries"&&req.method==="GET")return reply(res,200,classroom.deliveries(who,auth.sessions.filter(s=>!s.revoked&&s.expiresAt>now()).map(s=>({...s,...accounts.find(a=>a.name===s.account)}))));
          if(req.method!=="POST")throw fail(405,"请求方法不支持");
          const input=await json(req);
          if(req.headers["x-haiz-actor"]&&req.headers["x-haiz-actor"]!==who.name)throw fail(409,"会话身份已改变，请重新进入班级作业");
          if(url.pathname==="/api/classroom/receipt")return reply(res,200,classroom.receipt(who,session.id,input,auth.sessions.filter(s=>!s.revoked&&s.expiresAt>now()).map(s=>s.id)));
          if(["/api/classroom/assignments","/api/classroom/assignment-action"].includes(url.pathname))return reply(res,200,classroom.command(who,input,url.pathname.endsWith("assignment-action")?"action":"upsert",req.headers["idempotency-key"]));
          throw fail(404,"公共作业接口不存在");
        }
        if (await flow(req, res, url, who)) return;
        throw fail(404, "接口不存在");
      }
      if (req.method === "POST") throw fail(405, "此页面只读");
      if (
        url.pathname === "/" ||
        url.pathname === "/world/flow/" ||
        url.pathname === "/world/flow/index.html"
      ) {
        const html = readFileSync(
          path.join(ROOT, "flow/index.html"),
          "utf8",
        ).replace(
          "<head>",
          '<head><base href="/world/flow/">' +
            `<script nonce="${nonce}">window.HAIZ_PILOT=true;</script>`,
        );
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        });
        return res.end(html);
      }
      if (
        ["/world/stillroom/", "/world/stillroom/index.html"].includes(
          url.pathname,
        )
      ) {
        const html = readFileSync(
          path.join(ROOT, "stillroom/index.html"),
          "utf8",
        ).replace(
          "<head>",
          "<head>" +
            `<script nonce="${nonce}">window.HAIZ_PILOT=true;</script>`,
        );
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        });
        return res.end(html);
      }
      if(["/world/classroom/","/world/classroom/index.html"].includes(url.pathname)){
        res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store"});
        return res.end(readFileSync(path.join(ROOT,"classroom/index.html"),"utf8"));
      }
      const assets = new Map(
        [
          "app.js",
          "rules.js",
          "style.css",
          "manifest.webmanifest",
          "sw.js",
        ].map((f) => ["/world/flow/" + f, "flow/" + f]),
      );
      for(const f of ["app.js","style.css"])assets.set("/world/classroom/"+f,"classroom/"+f);
      assets.set("/world/homework-core.js","homework-core.js");
      for (const f of ["icon-192.png", "icon-512.png"])
        assets.set("/world/assets/" + f, "assets/" + f);
      for (const f of [
        "app.js",
        "styles.css",
        "sw.js",
        "manifest.webmanifest",
        "assets/favicon.svg",
        "assets/grain.svg",
        "assets/offline-study.svg",
      ])
        assets.set("/world/stillroom/" + f, "stillroom/" + f);
      if (!assets.has(url.pathname))
        throw fail(404, "此试用服务只提供Flow，原校园与源码不通过此服务公开");
      const f = assets.get(url.pathname),
        mime = f.endsWith(".js")
          ? "text/javascript"
          : f.endsWith(".css")
            ? "text/css"
            : f.endsWith(".png")
              ? "image/png"
              : f.endsWith(".svg")
                ? "image/svg+xml"
                : "application/manifest+json";
      res.writeHead(200, { "Content-Type": mime, "Cache-Control": "no-cache" });
      res.end(
        req.method === "HEAD" ? undefined : readFileSync(path.join(ROOT, f)),
      );
    } catch (e) {
      if (!res.headersSent) {
        if (e.status === 429) res.setHeader("Retry-After", "60");
        reply(res, e.status || 500, {
          error: e.status ? e.message : "服务暂时不可用；请保留本机内容并重试",
        });
      } else res.end();
    }
  };
  let mutations = Promise.resolve();
  const dispatch = (req, res) => {
    if (req.method === "POST") {
      mutations = mutations
        .then(() => handler(req, res))
        .catch(() => {
          if (!res.headersSent) reply(res, 500, { error: "请求失败，请重试" });
        });
    } else handler(req, res);
  };
  const server = tls
    ? https.createServer(tls, dispatch)
    : http.createServer(dispatch);
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  return {
    server,
    bootstrapFile,
    issueInvite: issue,
    close: () => {
      server.closeAllConnections();
      return new Promise((r) => server.close(r));
    },
  };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const tls =
    process.env.HAIZ_TLS_CERT && process.env.HAIZ_TLS_KEY
      ? {
          cert: readFileSync(process.env.HAIZ_TLS_CERT),
          key: readFileSync(process.env.HAIZ_TLS_KEY),
        }
      : null;
  const pilot = createPilotServer({
    origin: process.env.HAIZ_PUBLIC_ORIGIN,
    tls,
    behindProxy: process.env.HAIZ_BEHIND_PROXY === "1",
    directory: process.env.HAIZ_DATA_DIR,
  });
  pilot.server.listen(Number(process.env.PORT || 8790), "127.0.0.1", () =>
    console.log(
      `HAIZ fictional pilot ready. Public origin: ${process.env.HAIZ_PUBLIC_ORIGIN}\nBootstrap invitation file (private): ${pilot.bootstrapFile}`,
    ),
  );
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => pilot.close().then(() => process.exit(0)));
}
