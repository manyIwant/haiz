import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDemoServer } from "../scripts/classroom-server.mjs";
import { randomUUID } from "node:crypto";
test("Flow: ownership, revisions, confirmation, idempotency, feed projection, withdrawal and persistence", async () => {
  const directory = mkdtempSync(join(tmpdir(), "haiz-flow-"));
  const demo = createDemoServer({ directory });
  await new Promise((r) => demo.server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${demo.server.address().port}`;
  const call = async (role, path, body, key = randomUUID()) => {
    const r = await fetch(base + "/api/flow/" + path, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: "Bearer " + demo.credentials[role],
        "Content-Type": "application/json",
        "Idempotency-Key": key,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: r.status, data: await r.json() };
  };
  try {
    const scope = demo.snapshot({
      name: "teacher-a",
      role: "teacher",
      scope: "高一（1）班",
    }).identity.scope;
    const me = (await call("teacher-a", "me")).data.identity;
    const d = {
      id: randomUUID(),
      expectedRevision: 0,
      title: "实验准备",
      body: "私人备课记录不应投屏",
      summary: "带好实验记录纸",
      scope: me.scope,
      startsAt: new Date(Date.now() - 1000).toISOString(),
      expiresAt: new Date(Date.now() + 300000).toISOString(),
    };
    assert.equal((await call("student-a", "drafts", d)).status, 403);
    const k = randomUUID(),
      first = await call("teacher-a", "drafts", d, k);
    assert.equal(first.status, 200);
    assert.equal(
      (await call("teacher-a", "drafts", d, k)).data.draft.revision,
      1,
    );
    assert.equal(
      (await call("teacher-b", "drafts", { ...d, expectedRevision: 1 })).status,
      404,
    );
    assert.equal((await call("display-a", "drafts")).status, 403);
    const changed = await call("teacher-a", "drafts", {
      ...d,
      expectedRevision: 1,
      body: "Windows补充",
    });
    assert.equal(changed.data.draft.revision, 2);
    const conflict = await call("teacher-a", "drafts", {
      ...d,
      expectedRevision: 1,
      body: "手机另一版本",
    });
    assert.equal(conflict.status, 409);
    assert.equal(conflict.data.remote.body, "Windows补充");
    assert.equal(
      (await call("teacher-a", "publish", { id: d.id, expectedRevision: 2 }))
        .status,
      400,
    );
    const publish = {
        id: d.id,
        expectedRevision: 2,
        confirmed: true,
        confirmedSummary: d.summary,
      },
      pk = randomUUID();
    assert.equal((await call("student-a", "publish", publish)).status, 403);
    const p = await call("teacher-a", "publish", publish, pk);
    assert.equal(p.status, 200);
    assert.equal(
      (await call("teacher-a", "publish", publish, pk)).data.notice.id,
      p.data.notice.id,
    );
    const feed = (await call("display-a", "feed")).data;
    assert.equal(feed.notices.length, 1);
    assert.ok(!JSON.stringify(feed).includes("Windows补充"));
    assert.ok(!("ownerId" in feed.notices[0]));
    assert.equal((await call("display-b", "feed")).data.notices.length, 0);
    assert.equal(
      (
        await call("teacher-a", "revoke", {
          id: p.data.notice.id,
          expectedRevision: 1,
        })
      ).status,
      200,
    );
    assert.equal((await call("display-a", "feed")).data.notices.length, 0);
    await demo.close();
    const restart = createDemoServer({ directory });
    assert.equal(
      restart.snapshot({ role: "display", scope }).format,
      "haiz-local-sync",
    );
    await new Promise((r) => restart.server.listen(0, "127.0.0.1", r));
    const r = await fetch(
      `http://127.0.0.1:${restart.server.address().port}/api/flow/drafts`,
      {
        headers: {
          Authorization: "Bearer " + restart.credentials["teacher-a"],
        },
      },
    );
    assert.equal((await r.json()).drafts[0].body, "Windows补充");
    await restart.close();
  } finally {
    if (demo.server.listening) await demo.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
