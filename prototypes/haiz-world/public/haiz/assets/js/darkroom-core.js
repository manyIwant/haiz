/* Original, bounded score format. A share URL is the storage, not a server room. */
(function (root, factory) {
  const core = factory();
  if (typeof module === "object" && module.exports) module.exports = core;
  else root.HaizDarkroomCore = core;
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";
  const places = [
    {
      id: "fengqitang",
      name: "凤栖堂",
      en: "UNDER GREEN EAVES",
      image: "assets/images/web/fengqitang-1600.jpg",
      alt: "凤栖堂既有实拍，绿瓦叠檐、红金立柱与木格窗",
      observation: "绿瓦的亮处不是同一片绿。停下来，看看瓦沟怎样接住一束光。",
      poem: ["把铃声留在檐下，", "把下一句交给风。"],
      voice: "檐下钟音",
      type: "BELL / AN IMAGINED CHIME",
    },
    {
      id: "lanshu",
      name: "榄仁树",
      en: "A SMALL SHADE OF TIME",
      image: "assets/images/web/lanshu-1600.jpg",
      alt: "项目已有榄仁树照片，枝叶伸展在校园上方",
      observation:
        "不急着穿过树荫。看枝条怎样分岔，也看明亮的天空怎样从叶隙里穿过。",
      poem: ["一片叶子落下之前，", "让课间再长一拍。"],
      voice: "叶间低音",
      type: "LEAF / A BREATH OF WOOD",
    },
    {
      id: "yanchi",
      name: "砚池",
      en: "THE WATER HOLDS A PAUSE",
      image: "assets/images/web/wenhua_yanchi-800.jpg",
      alt: "项目已有砚池校园影像",
      observation:
        "池水把周围的颜色暂时留住。把一个音放在这里，再听它慢慢散开。",
      poem: ["不必每一格都有声音，", "水面也需要留白。"],
      voice: "水面轻响",
      type: "WATER / RESONANT DROPS",
    },
    {
      id: "library",
      name: "图书馆",
      en: "A MARGIN FOR TOMORROW",
      image: "assets/images/campus/campus_library.jpg",
      alt: "图书馆既有实拍，白色外廊、蓝色弧窗、外部楼梯与金属圆顶",
      observation:
        "沿着水平的外廊，找到那扇向上拱起的蓝窗。一座建筑也有它的段落与停顿。",
      poem: ["书页翻过的一瞬间，", "明天有了新的边。"],
      voice: "纸页节奏",
      type: "PAGE / A SOFT PAPER PULSE",
    },
  ];
  const masks = {
    shade: [145, 17, 68, 32],
    rain: [17, 68, 170, 130],
    blank: [0, 0, 0, 0],
  };
  const text = (s) =>
    Array.from(typeof s === "string" ? s : "")
      .filter((c) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(c))
      .slice(0, 80)
      .join("");
  function clean(raw) {
    raw = raw && typeof raw === "object" ? raw : {};
    return {
      v: 1,
      place: places.some((p) => p.id === raw.place) ? raw.place : places[0].id,
      tempo:
        typeof raw.tempo === "number" && Number.isFinite(raw.tempo)
          ? Math.max(60, Math.min(132, Math.round(raw.tempo)))
          : 84,
      masks: Array.from({ length: 4 }, (_, i) =>
        Number.isInteger(raw.masks?.[i])
          ? Math.max(0, Math.min(255, raw.masks[i]))
          : masks.shade[i],
      ),
      note: text(raw.note),
      paper: raw.paper === "clay" ? "clay" : "jade",
    };
  }
  function preset(id) {
    return clean({
      masks: masks[id] || masks.shade,
      tempo: id === "rain" ? 104 : 84,
    });
  }
  function encode(raw) {
    const s = JSON.stringify(clean(raw));
    let binary = "";
    for (const n of new TextEncoder().encode(s))
      binary += String.fromCharCode(n);
    return btoa(binary)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }
  function decode(encoded) {
    if (
      typeof encoded !== "string" ||
      encoded.length > 2200 ||
      !/^[A-Za-z0-9_-]+$/.test(encoded)
    )
      return null;
    try {
      const bytes = Uint8Array.from(
          atob(encoded.replace(/-/g, "+").replace(/_/g, "/")),
          (c) => c.charCodeAt(0),
        ),
        raw = JSON.parse(
          new TextDecoder("utf-8", { fatal: true }).decode(bytes),
        );
      if (
        raw?.v !== 1 ||
        !Array.isArray(raw.masks) ||
        raw.masks.length !== 4 ||
        !raw.masks.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) ||
        !places.some((p) => p.id === raw.place) ||
        typeof raw.note !== "string" ||
        typeof raw.tempo !== "number" ||
        raw.tempo < 60 ||
        raw.tempo > 132 ||
        !["jade", "clay"].includes(raw.paper)
      )
        return null;
      return clean(raw);
    } catch {
      return null;
    }
  }
  function toggle(raw, row, step, value) {
    const s = clean(raw);
    if (
      !Number.isInteger(row) ||
      row < 0 ||
      row > 3 ||
      !Number.isInteger(step) ||
      step < 0 ||
      step > 7
    )
      return s;
    const bit = 1 << step;
    s.masks[row] =
      value === undefined
        ? s.masks[row] ^ bit
        : value
          ? s.masks[row] | bit
          : s.masks[row] & ~bit;
    return s;
  }
  function trace(points) {
    const bins = Array.from({ length: 8 }, () => ({ sum: 0, count: 0 }));
    for (const p of Array.isArray(points) ? points.slice(0, 1600) : []) {
      if (
        typeof p?.x !== "number" ||
        typeof p?.y !== "number" ||
        !Number.isFinite(p.x) ||
        !Number.isFinite(p.y) ||
        p.x < 0 ||
        p.x > 1 ||
        p.y < 0 ||
        p.y > 1
      )
        continue;
      const bin = bins[Math.min(7, Math.floor(p.x * 8))];
      bin.sum += p.y;
      bin.count++;
    }
    const result = [0, 0, 0, 0];
    bins.forEach((bin, step) => {
      if (bin.count)
        result[Math.min(3, Math.floor((bin.sum / bin.count) * 4))] |= 1 << step;
    });
    return result;
  }
  function code(raw) {
    let hash = 2166136261;
    for (const c of JSON.stringify(clean(raw)))
      hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
    return (hash >>> 0).toString(16).toUpperCase().padStart(8, "0");
  }
  return {
    places,
    clean,
    preset,
    encode,
    decode,
    toggle,
    trace,
    code,
    text,
    active: (raw, row, step) => !!(raw.masks[row] & (1 << step)),
    duration: (raw) => (8 * 60) / clean(raw).tempo,
  };
});
