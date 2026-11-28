// Native 003 · the intake chain on the page side: first switch-on with no group, import of what the
// phone queued, recognition, dedupe across groups, and confirmation into a task and a schedule entry.
// (The phone side — access, listener, group match, task words — is HaizIntakePolicyTest.java.)
import { test } from "node:test";
import assert from "node:assert/strict";

// the smallest browser the store needs
const noop = () => {};
const el = () => ({ style: { setProperty: noop }, dataset: {}, classList: { add: noop, remove: noop, toggle: noop }, setAttribute: noop, appendChild: noop, addEventListener: noop });
Object.assign(globalThis, {
  innerWidth: 360, innerHeight: 800, devicePixelRatio: 3,
  location: { hash: "#/inbox", search: "", href: "http://localhost/#/inbox" },
  matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop, addListener: noop }),
  requestAnimationFrame: (f) => setTimeout(() => f(performance.now()), 16), cancelAnimationFrame: clearTimeout,
  addEventListener: noop, removeEventListener: noop, history: { length: 1, pushState: noop, replaceState: noop },
  document: { documentElement: el(), body: el(), hidden: false, addEventListener: noop, removeEventListener: noop, createElement: el, querySelector: () => null, getElementById: () => null },

});
globalThis.window = globalThis;
globalThis.localStorage ??= { _m: new Map(), getItem(k) { return this._m.get(k) ?? null; }, setItem(k, v) { this._m.set(k, String(v)); }, removeItem(k) { this._m.delete(k); } };
const { getState, setState } = await import("../src/app/store.ts");
const inbox = await import("../src/intake/inbox.ts");

const now = Date.now();
setState({ identity: { id: "t1", name: "测试" }, inbox: [], tasks: [], events: [], intake: { enabled: false, groups: [], sources: {} } });

test("the switch turns on before any group is chosen (the 002 deadlock)", async () => {
  await inbox.setIntake({ enabled: true, sources: { wechat: true } });
  assert.equal(getState().intake.enabled, true);
  assert.deepEqual(getState().intake.groups, []);
  await inbox.setIntake({ groups: ["高二（3）班家校群"] });
  assert.equal(getState().intake.enabled, true, "choosing a group keeps it on");
});

test("queued notices are recognised, chatter is dropped, repeats merge across groups", () => {
  const n = inbox.importEntries([
    { id: "a", source: "wechat", group: "高二（3）班家校群", text: "王老师: 请大家周五18:00前在学习通提交物理实验报告", at: now - 60000 },
    { id: "b", source: "wechat", group: "高二（3）班家校群", text: "李同学: 收到", at: now - 50000 },
    { id: "c", source: "wechat", group: "高二年级群", text: "王老师: 请大家周五18:00前在学习通提交物理实验报告", at: now - 40000 },
  ], true);
  assert.equal(n, 1);
  const items = getState().inbox;
  assert.equal(items.length, 1);
  assert.equal(items[0].status, "pending");
  assert.deepEqual(items[0].also, ["高二年级群"]);
  const d = inbox.webDiag();
  assert.equal(d.imported, 3); assert.equal(d.added, 1); assert.equal(d.notTask, 1); assert.equal(d.merged, 1);
  assert.ok(!JSON.stringify(d).includes("收到"), "diagnostics hold no text");
});

test("nothing becomes a task or an event until it is confirmed, then both are linked", () => {
  const id = getState().inbox[0].id;
  assert.equal(getState().tasks.length, 0);
  inbox.confirmAsTask(id);
  assert.equal(getState().tasks.length, 1);
  assert.match(getState().tasks[0].note, /高二（3）班家校群/);
  inbox.confirmAsEvent(id);
  assert.equal(getState().events.length, 1);
  const it = getState().inbox[0];
  assert.equal(it.status, "confirmed");
  assert.ok(it.linked.taskId && it.linked.eventId);
});
