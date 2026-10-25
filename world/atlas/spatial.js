/* HAIZ ATLAS / PLACE — progressive enhancement for an aerial-photo narrative.
   Landmark positions are editorial annotations, NOT surveyed coordinates.
   No WebGL, remote request, motion loop, or live campus claim. */
(function () {
  "use strict";
  const stage = document.getElementById("spatialStage");
  if (!stage) return;
  const $ = selector => stage.querySelector(selector);
  const records = Object.freeze({
    overview: {
      name:"府城校区",meta:"00 / THE GROUND WE SHARE",
      text:"四处入口，一所熟悉的学校。先选一个地方，再决定走向哪里。",
      photo:"../../assets/images/campus/aerial_campus.jpg",
      href:"../campus.html",action:"打开数字校园"
    },
    fengqi: {
      name:"凤栖堂",meta:"01 / ARCHITECTURE",
      text:"从砖墙和檐影出发，慢慢认识一座建筑。",
      photo:"../../assets/images/campus/campus_fengqitang.jpg",
      href:"../campus.html",action:"走进校园"
    },
    pond: {
      name:"砚池",meta:"02 / FIELD NOTES",
      text:"那些每天路过的水面，也值得停下来看看。",
      photo:"../../assets/images/campus/campus_yanchi.jpg",
      href:"../../architecture.html",action:"阅读建筑观察"
    },
    library: {
      name:"图书馆",meta:"03 / STUDY SPACE",
      text:"从校园中的一处地点，转入数字世界里的安静书桌。",
      photo:"../../assets/images/campus/campus_library.jpg",
      href:"../stillroom/",action:"进入 STILLROOM"
    },
    classroom: {
      name:"教学楼",meta:"04 / INNER WORLD",
      text:"熟悉的走廊，在概念场景里变成可以行走的空间。",
      photo:"../../assets/images/campus/campus_yihao.jpg",
      href:"../room/immersive/",action:"进入概念教室"
    }
  });
  let selected = "overview";
  const buttons = Array.from(stage.querySelectorAll("[data-spatial-place]"));
  const moodButtons = Array.from(stage.querySelectorAll("[data-spatial-mood]"));
  const moodKey = "haiz-atlas-visual-time-v1";
  const supported = ["day","dusk","night"];
  function paintPlace(name, focus = false) {
    if (!Object.prototype.hasOwnProperty.call(records,name)) return;
    selected = name;
    const record = records[name];
    stage.dataset.place = name;
    buttons.forEach(button => button.setAttribute("aria-pressed",String(button.dataset.spatialPlace === name)));
    $("#spatialLocationName").textContent = record.name;
    $("#spatialLocationMeta").textContent = record.meta;
    $("#spatialLocationText").textContent = record.text;
    const image = $("#spatialLocationPhoto");
    image.src = record.photo;
    image.alt = name === "overview" ? "校园航拍影像" : record.name+"的校园图片";
    $("#spatialLocationAction").href = record.href;
    $("#spatialLocationAction").textContent = record.action+" ↗";
    if (focus) $("#spatialLocationAction").focus({preventScroll:true});
  }
  function mood(mode) {
    if (!supported.includes(mode)) return;
    stage.dataset.mood = mode;
    moodButtons.forEach(button => button.setAttribute("aria-pressed",String(button.dataset.spatialMood === mode)));
    try { localStorage.setItem(moodKey,mode); } catch (_) {}
  }
  let saved = "day";
  try { saved = localStorage.getItem(moodKey) || saved; } catch (_) {}
  mood(supported.includes(saved) ? saved : "day");
  for (const button of buttons) button.addEventListener("click",() => paintPlace(button.dataset.spatialPlace));
  for (const button of moodButtons) button.addEventListener("click",() => mood(button.dataset.spatialMood));
  $("#spatialReset").addEventListener("click",() => paintPlace("overview"));
  stage.addEventListener("keydown", event => {
    if (event.key === "Escape" && selected !== "overview") {
      event.preventDefault();
      paintPlace("overview");
      $("#spatialReset").focus({preventScroll:true});
    }
  });
  paintPlace("overview");
  const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
  const pointerPreference = matchMedia("(hover: hover) and (pointer: fine)");
  let raf = 0;
  let driftX = 0;
  let driftY = 0;
  const commitDrift = () => {
    raf = 0;
    stage.style.setProperty("--drift-x",driftX.toFixed(2)+"px");
    stage.style.setProperty("--drift-y",driftY.toFixed(2)+"px");
  };
  function resetDrift() {
    if (raf) cancelAnimationFrame(raf);
    driftX = driftY = raf = 0;
    commitDrift();
  }
  stage.addEventListener("pointermove",event => {
    if (event.pointerType !== "mouse" || !pointerPreference.matches || motionPreference.matches || document.hidden) return;
    const bounds = stage.getBoundingClientRect();
    driftX = ((event.clientX - bounds.left) / bounds.width - .5) * -13;
    driftY = ((event.clientY - bounds.top) / bounds.height - .5) * -10;
    if (!raf) raf = requestAnimationFrame(commitDrift);
  },{passive:true});
  stage.addEventListener("pointerleave",resetDrift);
  document.addEventListener("visibilitychange",() => { if (document.hidden) resetDrift(); });
  motionPreference.addEventListener?.("change",() => { if (motionPreference.matches) resetDrift(); });
  pointerPreference.addEventListener?.("change",() => { if (!pointerPreference.matches) resetDrift(); });
})();
