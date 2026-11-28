// Native 003 · the app is called HAIZ on the phone, and still installs over earlier builds:
// same applicationId (the signing certificate is checked in CI against its pinned SHA-256).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

test("launcher and system name is HAIZ, without Preview", () => {
  const strings = read("../../android/app/src/main/res/values/strings.xml");
  assert.match(strings, /<string name="app_name">HAIZ<\/string>/);
  assert.match(strings, /<string name="title_activity_main">HAIZ<\/string>/);
  assert.equal(JSON.parse(read("../../capacitor.config.json")).appName, "HAIZ");
});

test("applicationId is unchanged, so the update installs over 2107-2109 and keeps data", () => {
  assert.match(read("../../android/app/build.gradle"), /applicationId\s+"space\.haiz\.app\.preview"/);
  assert.equal(JSON.parse(read("../../capacitor.config.json")).appId, "space.haiz.app.preview");
});
