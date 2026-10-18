const assert = require("node:assert/strict"),
  C = require("../assets/js/darkroom-core.js");
let count = 0;
const test = (name, fn) => {
  fn();
  count++;
  console.log("PASS", name);
};
test("four real campus image paths and bounded defaults", () => {
  const fs = require("node:fs");
  assert.equal(C.places.length, 4);
  for (const p of C.places) assert(fs.existsSync(p.image));
  assert.deepEqual(C.clean(null), C.preset("shade"));
});
test("desktop/mobile share format preserves Chinese, emoji, line breaks and zero masks", () => {
  for (const paper of ["jade", "clay"]) {
    const s = C.clean({
      v: 1,
      place: "library",
      tempo: 100,
      masks: [0, 255, 128, 17],
      note: "一阵风 🌿\n<不是 HTML>",
      paper,
    });
    assert.deepEqual(C.decode(C.encode(s)), s);
    assert.equal(C.code(s).length, 8);
  }
});
test("malformed or oversized URLs cannot inject unsupported data", () => {
  for (const raw of [
    "",
    null,
    "<script>",
    "x".repeat(2201),
    "__",
    btoa('{"v":2}'),
    btoa("{}"),
  ])
    assert.equal(C.decode(raw), null);
  const bad = C.preset("shade");
  bad.masks = [1, 2, 3, -1];
  assert.equal(C.decode(btoa(JSON.stringify(bad))), null);
});
test("editing is immutable and strictly bounded", () => {
  const start = C.preset("blank"),
    next = C.toggle(start, 3, 7);
  assert.deepEqual(start.masks, [0, 0, 0, 0]);
  assert.equal(next.masks[3], 128);
  assert.equal(C.toggle(next, 3, 7).masks[3], 0);
  assert.deepEqual(C.toggle(start, 4, 0), start);
  assert.equal(C.toggle(next, 3, 7, true).masks[3], 128);
});
test("a photograph gesture becomes spatially quantized music, rejecting nonfinite coordinates", () => {
  assert.deepEqual(
    C.trace([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 0.5, y: 0.4 },
      null,
      { x: Infinity, y: 0 },
      { x: -1, y: 0 },
    ]),
    [1, 16, 0, 128],
  );
  assert.deepEqual(C.trace(null), [0, 0, 0, 0]);
  assert.deepEqual(
    C.trace([
      { x: 0.2, y: 0.2 },
      { x: 0.2, y: 0.8 },
    ]),
    [0, 0, 2, 0],
  );
});
test("untrusted storage sanitizes controls, nonfinite values and text lengths", () => {
  const s = C.clean({
    place: "javascript:alert(1)",
    tempo: Infinity,
    masks: [NaN, -1, 300, "2"],
    note: "🌿".repeat(100) + "\u0000",
    paper: "evil",
  });
  assert.equal(s.place, "fengqitang");
  assert.equal(s.tempo, 84);
  assert.deepEqual(s.masks, [145, 0, 255, 32]);
  assert.equal(Array.from(s.note).length, 80);
  assert.equal(s.paper, "jade");
  for (const tempo of [-100, 300]) assert(C.duration(C.clean({ tempo })) <= 8);
});
test("every mask and bit survives a share round trip", () => {
  for (let n = 0; n < 256; n++)
    for (let row = 0; row < 4; row++) {
      const s = C.preset("blank");
      s.masks[row] = n;
      const decoded = C.decode(C.encode(s));
      assert.deepEqual(decoded, s);
      for (let bit = 0; bit < 8; bit++)
        assert.equal(C.active(decoded, row, bit), !!(n & (1 << bit)));
    }
});
console.log("PASS", count, "darkroom core groups, 1024 mask round trips");
