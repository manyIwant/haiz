import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pilotFixture } from "./pilot-fixture.mjs";
test("HTTPS pilot invitations, scoped handoff, cookies, revocation, restart, reset, public projection", async () => {
  const f = await pilotFixture();
  try {
    assert.equal((await f.call("/api/flow/me")).status, 401);
    const admin = await f.call("/api/flow/login", {
      body: { invite: f.bootstrap, fictionalOnly: true },
    });
    assert.equal(admin.status, 200);
    assert.match(
      admin.headers["set-cookie"][0],
      /HttpOnly; Secure; SameSite=Strict/,
    );
    assert.equal(
      (
        await f.call("/api/flow/login", {
          body: { invite: f.bootstrap, fictionalOnly: true },
        })
      ).status,
      401,
    );
    const login = async (account) => {
      const invite = await f.call("/api/flow/admin/invite", {
        cookie: admin.cookie,
        body: { account },
      });
      assert.equal(invite.status, 200);
      return f.call("/api/flow/login", {
        body: { invite: invite.body.invite, fictionalOnly: true },
      });
    };
    const mobile = await login("teacher-a"),
      desk = await login("teacher-a"),
      other = await login("teacher-b"),
      student = await login("student-a"),
      screen = await login("display-a");
    const draft = {
      id: crypto.randomUUID(),
      expectedRevision: 0,
      title: "虚构材料提醒",
      body: "私人准备事项",
      materialNotes: "虚构课件.pdf · 只同步描述",
      summary: "携带实验记录纸",
      scope: "演示一班",
      startsAt: new Date(Date.now() - 1000).toISOString(),
      expiresAt: new Date(Date.now() + 60000).toISOString(),
    };
    assert.equal(
      (await f.call("/api/flow/drafts", { cookie: mobile.cookie, body: draft }))
        .status,
      200,
    );
    const list = await f.call("/api/flow/drafts", { cookie: desk.cookie });
    assert.equal(list.body.drafts[0].id, draft.id);
    assert.equal(list.body.drafts[0].materialNotes, draft.materialNotes);
    assert.equal(
      (await f.call("/api/flow/drafts", { cookie: other.cookie })).body.drafts
        .length,
      0,
    );
    for (const who of [student, screen])
      assert.equal(
        (await f.call("/api/flow/drafts", { cookie: who.cookie })).status,
        403,
      );
    assert.equal(
      (
        await f.call("/api/flow/drafts", {
          cookie: other.cookie,
          body: { ...draft, id: crypto.randomUUID() },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await f.call("/api/flow/drafts", {
          cookie: mobile.cookie,
          body: { ...draft, id: crypto.randomUUID(), scope: "演示二班" },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await f.call("/api/flow/workspace", {
          cookie: mobile.cookie,
          body: {
            kind: "course",
            scope: "演示一班",
            title: "虚构实验课",
            startsAt: new Date().toISOString(),
            materialNotes: "器材清单",
          },
        })
      ).status,
      200,
    );
    assert.equal(
      (await f.call("/api/flow/workspace", { cookie: desk.cookie })).body
        .courses.length,
      1,
    );
    const notice = await f.call("/api/flow/publish", {
      cookie: mobile.cookie,
      body: {
        id: draft.id,
        expectedRevision: 1,
        confirmed: true,
        confirmedSummary: draft.summary,
      },
    });
    assert.equal(notice.status, 200);
    const feed = await f.call("/api/flow/feed", { cookie: screen.cookie });
    assert.equal(feed.body.notices.length, 1);
    assert.ok(!JSON.stringify(feed.body).includes("私人"));
    assert.ok(!JSON.stringify(feed.body).includes("课件.pdf"));
    assert.equal(
      (
        await f.call("/api/flow/revoke", {
          cookie: desk.cookie,
          body: { id: notice.body.notice.id, expectedRevision: 1 },
        })
      ).status,
      200,
    );
    assert.equal(
      (await f.call("/api/flow/feed", { cookie: screen.cookie })).body.notices
        .length,
      0,
    );
    assert.equal(
      (await f.call("/api/flow/admin", { cookie: student.cookie })).status,
      403,
    );
    assert.equal(
      (
        await f.call("/api/flow/logout", {
          cookie: desk.cookie,
          body: {},
          headers: { Origin: "https://evil.invalid" },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await f.call("/api/flow/logout", {
          cookie: desk.cookie,
          body: {},
          headers: { Origin: "" },
        })
      ).status,
      403,
    );
    assert.equal((await f.call("/world/flow/store.mjs")).status, 404);
    assert.equal(
      (await f.call("/world/pilot/.data/identities.json")).status,
      404,
    );
    assert.ok(
      !readFileSync(join(f.directory, "identities.json"), "utf8").includes(
        mobile.cookie.slice(11),
      ),
    );
    await f.restart();
    assert.equal(
      (await f.call("/api/flow/drafts", { cookie: mobile.cookie })).body.drafts
        .length,
      2,
    );
    assert.equal(
      (await f.call("/api/flow/logout", { cookie: desk.cookie, body: {} }))
        .status,
      200,
    );
    assert.equal(
      (await f.call("/api/flow/me", { cookie: desk.cookie })).status,
      401,
    );
    const state = await f.call("/api/flow/admin", { cookie: admin.cookie });
    const id = state.body.sessions.find((s) => s.account === "student-a").id;
    assert.equal(
      (
        await f.call("/api/flow/admin/revoke", {
          cookie: admin.cookie,
          body: { id },
        })
      ).status,
      200,
    );
    assert.equal(
      (await f.call("/api/flow/me", { cookie: student.cookie })).status,
      401,
    );
    assert.equal(
      (
        await f.call("/api/flow/admin/reset", {
          cookie: admin.cookie,
          body: { confirm: "wrong" },
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await f.call("/api/flow/admin/reset", {
          cookie: admin.cookie,
          body: { confirm: "清理虚构数据" },
        })
      ).status,
      200,
    );
    assert.equal(
      (await f.call("/api/flow/me", { cookie: mobile.cookie })).status,
      401,
    );
    const fresh = await login("teacher-a");
    assert.equal(
      (await f.call("/api/flow/drafts", { cookie: fresh.cookie })).body.drafts
        .length,
      0,
    );
  } finally {
    await f.close();
  }
});
test("expired invitations and sessions fail closed; login attempts rate limited", async () => {
  let clock = Date.now();
  const f = await pilotFixture({
    now: () => clock,
    sessionMs: 1000,
    inviteMs: 500,
    loginLimit: 5,
  });
  try {
    const admin = await f.call("/api/flow/login", {
      body: { invite: f.bootstrap, fictionalOnly: true },
    });
    assert.equal(admin.status, 200);
    const invite = f.pilot.issueInvite("teacher-a");
    clock += 600;
    assert.equal(
      (
        await f.call("/api/flow/login", {
          body: { invite: invite.invite, fictionalOnly: true },
        })
      ).status,
      401,
    );
    clock += 500;
    assert.equal(
      (await f.call("/api/flow/me", { cookie: admin.cookie })).status,
      401,
    );
    for (let i = 0; i < 3; i++)
      await f.call("/api/flow/login", {
        body: { invite: "invalid", fictionalOnly: true },
      });
    assert.equal(
      (
        await f.call("/api/flow/login", {
          body: { invite: "invalid", fictionalOnly: true },
        })
      ).status,
      429,
    );
  } finally {
    await f.close();
  }
});
