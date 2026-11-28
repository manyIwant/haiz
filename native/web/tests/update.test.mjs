// Regression for the one-tap updater: the real published manifest, field-level errors and
// native error classification. (Java side: android/app/src/test/.../HaizUpdateArgsTest.java.)
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateManifest, manifestProblem, describeError } from "../src/update/manifest.ts";

const PKG = "space.haiz.app.preview";
const fixture = JSON.parse(readFileSync(new URL("./fixtures/haiz-update-2108.json", import.meta.url), "utf8"));
const release = JSON.parse(readFileSync(new URL("../../release.json", import.meta.url), "utf8"));

test("the published 2108 manifest is valid and its numbers are plain JSON integers", () => {
  const v = validateManifest(fixture, PKG);
  assert.equal(v.ok, true, v.ok ? "" : manifestProblem(v.issues));
  assert.ok(Number.isSafeInteger(fixture.sizeBytes) && fixture.sizeBytes < 2 ** 31, "fits in a Java Integer: native must not need a Long");
});

test("missing, wrong type and wrong value are reported separately", () => {
  const { sizeBytes, ...noSize } = fixture;
  let v = validateManifest(noSize, PKG);
  assert.equal(v.ok, false); assert.match(manifestProblem(v.issues), /字段缺失.*sizeBytes/);
  v = validateManifest({ ...fixture, versionCode: "2108" }, PKG);
  assert.equal(v.ok, false); assert.match(manifestProblem(v.issues), /类型错误.*versionCode/);
  v = validateManifest({ ...fixture, apkUrl: "http://x/a.apk" }, PKG);
  assert.equal(v.ok, false); assert.match(manifestProblem(v.issues), /取值无效.*HTTPS/);
  v = validateManifest({ ...fixture, packageId: "other.app" }, PKG);
  assert.equal(v.ok, false);
});

test("native reject codes become distinct messages", () => {
  assert.match(describeError({ code: "NETWORK", message: "清单请求失败 HTTP 503" }), /^网络异常/);
  assert.match(describeError({ code: "MANIFEST_MISSING_FIELD", message: "更新信息缺少字段 sizeBytes" }), /字段缺失/);
  assert.match(describeError({ code: "MANIFEST_TYPE", message: "x" }), /类型错误/);
  assert.match(describeError({ code: "SIGNATURE_MISMATCH", message: "安装包签名与当前应用不同" }), /^签名校验失败/);
  assert.match(describeError({ code: "SHA_MISMATCH", message: "x" }), /SHA-256/);
});

test("the next release stays newer than what is published", () => {
  assert.ok(release.versionCode >= fixture.versionCode);
});

test("live: every update source points at a valid manifest of the same version", { skip: !process.env.HAIZ_LIVE_MANIFEST }, async () => {
  const urls = ["https://github.com/manyIwant/haiz/releases/latest/download/haiz-update.json", "https://haiz.space/updates/latest.json"];
  const got = [];
  for (const u of urls) {
    const r = await fetch(u + "?t=" + Date.now(), { redirect: "follow" });
    assert.equal(r.status, 200, u);
    const v = validateManifest(await r.json(), PKG);
    assert.equal(v.ok, true, u + ": " + (v.ok ? "" : manifestProblem(v.issues)));
    got.push(v.manifest.versionCode);
  }
  assert.equal(got[0], got[1], `sources disagree: ${got.join(" vs ")}`);
});
