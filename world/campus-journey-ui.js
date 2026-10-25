/* HAIZ WORLD / PLACE CONNECTIONS
   Contextual paths for a scene already rendered by the retained WebGL engine.
   This companion never substitutes a photo for geometry or mutates scene materials. */
(function () {
  "use strict";
  const root = new URL(document.baseURI);
  const params = new URLSearchParams(location.search);
  const destinations = {
    beimen: {name:"北门",type:"第一站 / 校门",image:"assets/images/campus/campus_fucheng_gate.jpg",summary:"从熟悉的校门开始，沿着校道慢慢走进去。",action:"返回 ATLAS 全校视野",route:"world/atlas/#campus"},
    fengqitang: {name:"凤栖堂",type:"建筑 / 馆舍",image:"assets/images/campus/campus_fengqitang.jpg",summary:"观察建筑的轮廓与光影，再进入校园故事。",action:"阅读建筑观察",route:"architecture.html?place=fengqitang"},
    yanchi: {name:"砚池",type:"风景 / 水岸",image:"assets/images/campus/campus_yanchi.jpg",summary:"从岸边观察这处风景。三维模型仅是艺术近似。",action:"阅读建筑观察",route:"architecture.html?place=yanchi"},
    library: {name:"图书馆",type:"学习 / 专注",image:"assets/images/campus/campus_library.jpg",summary:"在三维校园走近图书馆，再去另一处安静的数字自习空间。",action:"进入 STILLROOM 自习",route:"world/stillroom/"},
    yihao: {name:"一号教学楼",type:"教学 / 教室",image:"assets/images/campus/campus_yihao.jpg",summary:"这里的教学楼可以到达，另一座可行走的教室是独立概念场景。",action:"进入概念教室",route:"world/room/immersive/"}
  };
  const escape = value => String(value).replace(/[&<>"']/g,character=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[character]));
  function ready() {
    if (!window.haizWalk || !window.HaizCampus) return false;
    const nodes = new Set(window.HaizCampus.nodes.map(item=>item.id));
    let current = nodes.has(params.get("focus")) ? params.get("focus") : "beimen";
    const opener = new URL("world/atlas/#campus", root).href;
    const pause = document.getElementById("pauseDialog");
    const map = document.querySelector("#mapDialog .map-destinations");
    if (!pause || !map) return true;
    const panel = document.createElement("section");
    panel.className = "haiz-place-connection";
    panel.setAttribute("aria-label","地点与校园功能联动");
    // Only static, developer-authored records are inserted; URL parameters never reach innerHTML.
    panel.innerHTML = '<img class="haiz-connection-photo" alt="" loading="lazy"><div class="haiz-connection-copy"><span class="haiz-connection-category"></span><h3 class="haiz-connection-title"></h3><p class="haiz-connection-description"></p><div class="haiz-connection-actions"><a class="haiz-connection-route" href="#">继续探索 ↗</a><a class="haiz-connection-back" href="'+escape(opener)+'">返回 ATLAS ↗</a></div></div>';
    pause.querySelector(".dialog-top").insertAdjacentElement("afterend",panel);
    const panel2 = panel.cloneNode(true);
    map.insertBefore(panel2, map.firstChild);
    function setPlace(id) {
      current = destinations[id] ? id : "beimen";
      const spot = destinations[current];
      for (const card of [panel,panel2]) {
        card.querySelector(".haiz-connection-photo").src = new URL(spot.image, root).href;
        card.querySelector(".haiz-connection-photo").alt = spot.name + "的既有校园照片";
        card.querySelector(".haiz-connection-title").textContent = spot.name;
        card.querySelector(".haiz-connection-category").textContent = "HAIZ / " + spot.type;
        card.querySelector(".haiz-connection-description").textContent = spot.summary;
        const link = card.querySelector(".haiz-connection-route");
        link.textContent = spot.action + " ↗";
        link.href = new URL(spot.route, root).href;
      }
      document.body.dataset.campusStory = current;
    }
    setPlace(current);
    const focused = destinations[params.get("focus")];
    if (focused && nodes.has(params.get("focus"))) {
      const title = document.querySelector("#intro .intro-copy h1");
      if (title) {
        const line = document.createElement("span");
        line.textContent = focused.name + "。";
        title.replaceChildren(document.createTextNode("沿着光，走近"),document.createElement("br"),line);
      }
      const sub = document.querySelector("#intro .intro-sub");
      if (sub) sub.textContent = "从 HAIZ ATLAS 选中 " + focused.name + "。进入后，将落在附近可通行的安全位置；建筑模型并非实测复刻。";
      const photo = document.querySelector("#intro .intro-image");
      if (photo) {
        photo.src = new URL(focused.image,root).href;
        photo.alt = focused.name + "的校园影像（进入后切换为实时三维模型）";
      }
      document.getElementById("enterText").textContent = "抵达" + focused.name;
      const openIntro = document.createElement("a");
      openIntro.className = "haiz-arrival-back";
      openIntro.href = opener;
      openIntro.textContent = "← 返回 ATLAS 选一个地点";
      document.querySelector("#intro .intro-copy").append(openIntro);
    }
    // Clicking a genuine WebGL map destination switches the related function panel.
    map.addEventListener("click", event => {
      const button = event.target.closest("[data-destination],[data-room]");
      if (button && button.dataset.destination || button?.dataset.room) setPlace(button.dataset.destination || button.dataset.room);
    });
    window.HAIZPlaceConnections = Object.freeze({
      get selected(){return current;},
      get active(){return destinations[current];},
      setPlace(id){if (nodes.has(id)) setPlace(id);}
    });
    return true;
  }
  if (ready()) return;
  let attempts = 0;
  const timer = setInterval(()=>{
    if (ready() || ++attempts >= 900) clearInterval(timer);
  },100);
  window.addEventListener("pagehide",()=>clearInterval(timer),{once:true});
})();
