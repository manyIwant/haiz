/* SPDX-License-Identifier: AGPL-3.0-only
 * haiz campus adaptation, 2026-10-18. Original scene © 2026 幡幡 (TangfanOVO).
 * This independently runnable application is not a photographic campus replica.
 */
function roomEmit(type, payload = {}) {
  if (parent !== window && location.origin !== "null")
    parent.postMessage(
      { channel: "haiz:windowsill:v1", type, ...payload },
      location.origin,
    );
}
const roomDestinations = {
  phone: "life.html",
  toys: "darkroom.html",
  trips: "director.html",
  where: "campus-3d.html",
  maple: "windowsill/source.html",
};
function roomAction(key) {
  if (!Object.hasOwn(campusTags, key)) return;
  if (parent !== window) {
    roomEmit("action", { key });
    return;
  }
  const target = roomDestinations[key];
  if (target) location.href = "../../" + target;
  else say("回到课间窗台首页，即可使用便签、计时与留声工具。");
}
function roomSetSound(on) {
  if (!on) {
    roomSoundOn = false;
    AC?.suspend().catch(() => {});
    document.getElementById("cSound").setAttribute("aria-pressed", "false");
    document.getElementById("cSound").textContent = "声音 关";
    return;
  }
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) throw Error("Audio unavailable");
    AC ||= new Audio();
    AC.resume()
      .then(() => {
        if (document.hidden) return;
        roomSoundOn = AC.state === "running";
        document
          .getElementById("cSound")
          .setAttribute("aria-pressed", String(roomSoundOn));
        document.getElementById("cSound").textContent = roomSoundOn
          ? "声音 开"
          : "声音 关";
        if (roomSoundOn)
          say("合成雷声已开启，非现场录音；需在天气面板开启雷雨。");
      })
      .catch(() => say("此浏览器暂时无法开启声音。"));
  } catch {
    say("此浏览器暂时无法开启声音。");
  }
}
function roomPause(on) {
  userPaused = reduce || !!on;
  if (userPaused) {
    cancelAnimationFrame(sceneFrame);
    sceneFrame = 0;
  }
  clock.getDelta();
  const button = document.getElementById("cPause");
  button.setAttribute("aria-pressed", String(userPaused));
  button.disabled = reduce;
  button.textContent = reduce
    ? "静态模式"
    : userPaused
      ? "继续动态"
      : "暂停动态";
  invalidateScene(true);
  roomEmit("paused", { paused: userPaused });
}
function roomSetQuality(value) {
  if (!["low", "balanced", "high"].includes(value)) return;
  roomQuality = value;
  lowQ = value === "low";
  document.body.classList.toggle("lite", lowQ);
  gtao.enabled = value === "high" && !reduce;
  bokeh.enabled = value === "high" && !reduce;
  const ratio = Math.min(
    devicePixelRatio || 1,
    value === "high" ? 1.8 : value === "balanced" ? 1.3 : 1,
  );
  renderer.setPixelRatio(ratio);
  composer.setPixelRatio(ratio);
  sun.shadow.mapSize.set(
    value === "high" ? 2048 : 1024,
    value === "high" ? 2048 : 1024,
  );
  sun.shadow.map?.dispose();
  sun.shadow.map = null;
  resize();
  invalidateScene(true);
}
function roomPreset(id) {
  const p = {
    morning: { tod: "day", wind: 0.18, rain: 0 },
    rain: { tod: "day", wind: 0.35, rain: 0.55 },
    dusk: { tod: "dusk", wind: 0.22, rain: 0 },
    night: { tod: "night", wind: 0.12, rain: 0 },
    rainnight: { tod: "night", wind: 0.22, rain: 0.48 },
  }[id];
  if (!p) return;
  setSeason("summer");
  AUTO.on = false;
  tod = p.tod;
  Object.assign(WXS, {
    wind: p.wind,
    rain: p.rain,
    snow: 0,
    thunder: 0,
    autoSnow: false,
  });
  wxJump();
  stepTod(1);
  syncWxUI();
  instant = true;
  invalidateScene(true);
}
function roomSyncNotes(list) {
  const notes = Array.from({ length: 3 }, (_, i) =>
    Array.from(typeof list?.[i] === "string" ? list[i] : "")
      .slice(0, 40)
      .join(""),
  );
  window.fuyue.setNotes(notes);
  window.fuyue.setSpace(notes[0] || "愿你经过这里，刚好有风。");
  invalidateScene(true);
}
window.HaizDeskScene = {
  focus(key) {
    if (Object.hasOwn(campusTags, key) && key !== "tree") focus(key);
  },
  pause: roomPause,
  preset: roomPreset,
  quality: roomSetQuality,
  get diagnostics() {
    let models = 0;
    scene.traverse((o) => {
      if (o.userData.loadedFurniture) models++;
    });
    return {
      revision: THREE.REVISION,
      quality: roomQuality,
      paused: userPaused,
      suspended: hostPaused,
      reduced: reduce,
      frames: sceneFrames,
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      sound: roomSoundOn,
      focus: focusKey,
      view,
      models,
    };
  },
};
// Same-origin, same-frame and schema/command validation. No eval or arbitrary URLs.
addEventListener("message", (event) => {
  if (
    event.origin !== location.origin ||
    event.source !== parent ||
    event.data?.channel !== "haiz:windowsill:v1"
  )
    return;
  const d = event.data;
  if (d.type === "focus" && typeof d.key === "string")
    window.HaizDeskScene.focus(d.key);
  if (d.type === "preset" && typeof d.id === "string") roomPreset(d.id);
  if (d.type === "pause" && typeof d.value === "boolean") roomPause(d.value);
  if (d.type === "quality") roomSetQuality(d.value);
  if (d.type === "sound" && d.value === false) roomSetSound(false);
  if (d.type === "notes" && Array.isArray(d.value)) roomSyncNotes(d.value);
  if (
    d.type === "book" &&
    typeof d.left === "string" &&
    typeof d.right === "string"
  ) {
    window.fuyue.setBookPage({
      left: d.left.slice(0, 240),
      right: d.right.slice(0, 240),
      title: "校园小书",
      pages: ["01", "02"],
    });
    invalidateScene(true);
  }
  if (d.type === "suspend" && typeof d.value === "boolean") {
    hostPaused = d.value;
    if (hostPaused) {
      cancelAnimationFrame(sceneFrame);
      sceneFrame = 0;
      roomSetSound(false);
    } else {
      clock.getDelta();
      invalidateScene(true);
    }
  }
});
document.getElementById("cPause").onclick = () => roomPause(!userPaused);
document.getElementById("cSound").onclick = () => roomSetSound(!roomSoundOn);
document.getElementById("cOverview").onclick = () => {
  unfocus();
  setView(0);
  panTo = 0;
  invalidateScene(true);
};
for (const event of ["input", "change", "click", "pointerup", "pointermove"])
  document.addEventListener(event, () => invalidateScene(true), {
    passive: true,
  });
addEventListener("resize", () => invalidateScene(true));
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    cancelAnimationFrame(sceneFrame);
    sceneFrame = 0;
    roomSetSound(false);
    down = null;
    panV = 0;
  } else {
    clock.getDelta();
    invalidateScene(true);
  }
});
canvas.addEventListener("webglcontextlost", (event) => {
  event.preventDefault();
  cancelAnimationFrame(sceneFrame);
  sceneFrame = 0;
  hostPaused = true;
  roomSetSound(false);
  window.roomLoadFailure(new Error("WebGL context lost"));
});
if (reduce) {
  WXS.thunder = 0;
  document.getElementById("sThun").disabled = true;
}
roomSyncNotes([
  "抬头看看树影。",
  "今天只专注一件小事。",
  "愿你经过这里，刚好有风。",
]);
window.fuyue.setBookPage({
  left: "在绿瓦的亮处停留。\n\n光沿瓦沟断续，走廊替风留下一条路。",
  right:
    "把课间留成空白。\n\n校园的故事不只发生在黑板前，也发生在你愿意停一停的地方。",
  title: "窗边校园小书",
  pages: ["01", "02"],
});
roomPreset("morning");
roomSetQuality(roomQuality);
roomPause(userPaused);
roomEmit("ready");
