/* SPDX-License-Identifier: AGPL-3.0-only — haiz campus adaptation, 2026. */
(function (root) {
  "use strict";
  const KEY = "haiz.windowsill.v1";
  const cut = (value, n) =>
    Array.from(typeof value === "string" ? value : "")
      .slice(0, n)
      .join("");
  const initialNotes = [
    "抬头看看树影。",
    "今天只专注一件小事。",
    "愿你经过这里，刚好有风。",
  ];
  function clean(value) {
    const x =
      value && typeof value === "object" && !Array.isArray(value) ? value : {};
    return {
      version: 1,
      notes: Array.from({ length: 3 }, (_, i) =>
        cut(Array.isArray(x.notes) ? x.notes[i] : initialNotes[i], 40),
      ),
      letter: cut(x.letter, 600),
    };
  }
  function read(storage) {
    try {
      return clean(JSON.parse(storage.getItem(KEY) || "null"));
    } catch {
      return clean(null);
    }
  }
  function write(storage, value) {
    try {
      storage.setItem(KEY, JSON.stringify(clean(value)));
      return true;
    } catch {
      return false;
    }
  }
  const format = (ms) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return (
      String(Math.floor(s / 60)).padStart(2, "0") +
      ":" +
      String(s % 60).padStart(2, "0")
    );
  };
  function timer(minutes = 25) {
    let total = minutes * 60000,
      remaining = total,
      deadline = 0,
      running = false,
      complete = false;
    return {
      choose(n) {
        if (![2, 5, 15, 25].includes(n)) return false;
        total = remaining = n * 60000;
        deadline = 0;
        running = false;
        complete = false;
        return true;
      },
      start(now = Date.now()) {
        if (running) return;
        if (remaining <= 0) remaining = total;
        deadline = now + remaining;
        running = true;
        complete = false;
      },
      tick(now = Date.now()) {
        if (running) {
          remaining = Math.max(0, deadline - now);
          if (!remaining) {
            running = false;
            complete = true;
          }
        }
        return this.snapshot;
      },
      pause(now = Date.now()) {
        this.tick(now);
        running = false;
        deadline = 0;
      },
      reset() {
        remaining = total;
        deadline = 0;
        running = false;
        complete = false;
      },
      get snapshot() {
        return {
          total,
          remaining,
          running,
          complete,
          label: format(remaining),
        };
      },
    };
  }
  const prompts = [
    "只用三种声音，给一条熟悉的走廊配一段课间。",
    "找到一片被风翻面的叶子，把它的颜色写进便签。",
    "在暗房留出一块没有擦开的天空，送给明天的自己。",
    "想一想：如果校园是一封信，你最想保留哪一个转角？",
    "用五分钟，只做今天最想开始、却还没开始的一件小事。",
    "去看同一座屋檐在晨光与雨后怎样改变，先观察，再下结论。",
    "把你听见的风与真正的现场录音分开记下，它们各有自己的美。",
    "给下次来这里的你留一句话，不必是鼓励，也可以只是天气。",
  ];
  const books = [
    {
      title: "光沿瓦沟慢慢走",
      left: "在绿瓦的亮处停留。\n\n光沿瓦沟断续，走廊替风留下一条路。不要急着给它起名，先看看阴影停在哪里。",
      right:
        "这是为数字校园写的原创小书，不是校史记录。\n\n真实建筑的照片与观察线索，可以在「建筑观察」里继续对照。",
    },
    {
      title: "课间，也可以什么都不做",
      left: "把课间留成空白。\n\n校园的故事不只发生在黑板前，也发生在你愿意停一停的地方。桌上的杯子不催你，窗外的风也不。",
      right:
        "你可以给自己两分钟。\n\n不记录效率，不计算步数，不比较谁更忙。等一片树影挪过去，再开始下一件小事。",
    },
    {
      title: "寄给下一次打开这里的你",
      left: "如果你又经过这扇窗。\n\n希望你记得：这片海是想象，便签是你写的，真实校园仍在窗外等你观察。",
      right:
        "好看的事物也需要诚实。\n\n合成声音不是现场录音，模型不是照片，公开的网页也不会替你把信寄出去。留白，才有余地放进你自己的故事。",
    },
  ];
  const API = { KEY, cut, clean, read, write, timer, format, prompts, books };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  else root.DeskCore = API;
})(typeof window !== "undefined" ? window : globalThis);
