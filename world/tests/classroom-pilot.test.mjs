import test from "node:test";
import assert from "node:assert/strict";
import { pilotFixture } from "./pilot-fixture.mjs";
import { schoolDate } from "../homework-core.js";
test("HTTPS classroom shares identity, permissions, restart-safe mutations and version-bound receipts", async () => {
  let time = Date.now();
  const f = await pilotFixture({ now: () => time });
  try {
    const admin = await f.call("/api/flow/login", {
      body: { invite: f.bootstrap, fictionalOnly: true },
    });
    const login = async (account) => {
      const invite = await f.call("/api/flow/admin/invite", {
        cookie: admin.cookie,
        body: { account },
      });
      const response = await f.call("/api/flow/login", {
        body: { invite: invite.body.invite, fictionalOnly: true },
      });
      assert.equal(response.status, 200);
      return response.cookie;
    };
    const a = await login("teacher-a"),
      b = await login("teacher-b"),
      student = await login("student-a"),
      display = await login("display-a"),
      other = await login("display-b"),
      display2 = await login("display-a");
    const req = (cookie, route, body, key) =>
      f.call("/api/classroom/" + route, {
        cookie,
        body,
        ...(key ? { headers: { "Idempotency-Key": key } } : {}),
      });
    assert.equal((await req("", "assignments")).status, 401);
    const input = {
      scope: "演示一班",
      subject: "数学",
      content: "虚构：比较两种解法",
      studyDate: schoolDate(time),
    };
    for (const cookie of [b, student, display])
      assert.equal((await req(cookie, "assignments", input)).status, 403);
    const first = await req(a, "assignments", input, "class-write-123");
    assert.equal(first.status, 200);
    assert.ok(first.body.id);
    assert.equal(
      (await req(a, "assignments", input, "class-write-123")).body.replayed,
      true,
    );
    assert.equal(
      (
        await req(
          a,
          "assignments",
          { ...input, content: "changed" },
          "class-write-123",
        )
      ).status,
      409,
    );
    assert.equal(
      (await req(a, "assignments", { ...input, scope: "演示二班" })).status,
      200,
      "Multi-class teacher can publish to the second authorized class",
    );
    assert.equal(
      (await req(a, "assignments", { ...input, scope: "不存在的班级" })).status,
      403,
    );
    assert.equal(
      (
        await f.call("/api/classroom/assignments", {
          cookie: a,
          body: input,
          headers: { "X-Haiz-Actor": "teacher-b" },
        })
      ).status,
      409,
    );
    let snap = await req(display, "assignments");
    assert.equal(snap.body.assignments.length, 1);
    assert.equal(snap.body.assignments[0].actor, undefined);
    assert.equal((await req(other, "assignments")).body.assignments.length, 0);
    assert.equal(
      (
        await req(a, "receipt", {
          token: snap.body.receiptToken,
          state: "rendered",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await req(display2, "receipt", {
          token: snap.body.receiptToken,
          state: "rendered",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await req(display, "receipt", {
          token: snap.body.receiptToken + "x",
          state: "rendered",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await req(display, "receipt", {
          token: snap.body.receiptToken,
          state: "rendered",
        })
      ).status,
      200,
    );
    await req(display, "receipt", {
      token: snap.body.receiptToken,
      state: "received",
    });
    let devices = await req(a, "deliveries");
    assert.equal(devices.body.devices.find((d) => d.fresh).state, "rendered");
    assert.equal(
      (await req(b, "deliveries")).body.devices.some(
        (d) => d.scope === "演示一班",
      ),
      false,
    );
    assert.equal((await req(student, "deliveries")).status, 403);
    const beforeToken = snap.body.receiptToken;
    await req(a, "assignments", {
      ...input,
      id: first.body.id,
      version: 1,
      content: "虚构：修订后的内容",
    });
    assert.equal(
      (await req(display, "receipt", { token: beforeToken, state: "rendered" }))
        .status,
      409,
    );
    assert.equal(
      (await req(a, "deliveries")).body.devices.some((d) => d.fresh),
      false,
    );
    snap = await req(display, "assignments");
    await req(display, "receipt", {
      token: snap.body.receiptToken,
      state: "suppressed",
      reason: "manual-hidden",
    });
    assert.equal(
      (await req(a, "deliveries")).body.devices.find((d) => d.fresh).reason,
      "manual-hidden",
    );
    time += 91000;
    assert.equal(
      (await req(a, "deliveries")).body.devices.some((d) => d.fresh),
      false,
    );
    assert.equal(
      (
        await req(display, "receipt", {
          token: snap.body.receiptToken,
          state: "rendered",
        })
      ).status,
      409,
    );
    await f.restart();
    assert.equal(
      (await req(a, "assignments", input, "class-write-123")).body.id,
      first.body.id,
    );
    const row = (await req(display, "assignments")).body.assignments[0];
    assert.equal(row.version, 2);
    await req(a, "assignment-action", {
      id: row.id,
      version: row.version,
      operation: "withdraw",
    });
    await req(a, "assignments", input, "class-write-123");
    assert.equal(
      (await req(display, "assignments")).body.assignments.length,
      0,
    );
    const pending = await req(a, "assignments", {
      ...input,
      submitForReview: true,
    });
    assert.equal(
      (await req(display, "assignments")).body.assignments.length,
      0,
    );
    assert.equal(
      (
        await req(a, "assignment-action", {
          id: pending.body.id,
          version: 1,
          operation: "approve",
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await req(admin.cookie, "assignment-action", {
          id: pending.body.id,
          version: 1,
          operation: "approve",
        })
      ).status,
      200,
    );
    assert.equal(
      (await req(display, "assignments")).body.assignments.length,
      1,
    );
    const sessions = (await f.call("/api/flow/admin", { cookie: admin.cookie }))
      .body.sessions;
    const target = sessions.find((s) => s.account === "display-b");
    await f.call("/api/flow/admin/revoke", {
      cookie: admin.cookie,
      body: { id: target.id },
    });
    assert.equal((await req(other, "assignments")).status, 401);
    const current = (await req(display, "assignments")).body.receiptToken;
    await f.call("/api/flow/admin/reset", {
      cookie: admin.cookie,
      body: { confirm: "清理虚构数据" },
    });
    assert.equal(
      (await req(display, "receipt", { token: current, state: "rendered" }))
        .status,
      401,
    );
    assert.equal(
      (await req(admin.cookie, "assignments")).body.assignments.length,
      0,
    );
  } finally {
    await f.close();
  }
});
