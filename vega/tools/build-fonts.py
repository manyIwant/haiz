#!/usr/bin/env python3
"""重新生成 fonts/ 里的子集字体与 fonts/fonts.css。

平时不需要运行。只有当你在 content.config.js 里写了常用 3500 字以外的生僻字、
并且希望它们也用同一种手写体显示时才需要。

准备：
    pip install fonttools brotli
    下载两个开源字体（均为 SIL OFL 1.1）放进同一个目录，例如 ./font-src/ ：
      LXGWWenKai-Regular.ttf   https://github.com/lxgw/LxgwWenKai  (fonts/TTF/)
      NotoSerifSC[wght].ttf    https://github.com/google/fonts/tree/main/ofl/notoserifsc

运行（在 vega/ 目录下）：
    python3 tools/build-fonts.py ./font-src

做的事：
  1. 扫描 content.config.js / index.html / js/*.js（去掉注释），收集页面真正用到的字 → “核心”子集（首屏加载）。
  2. 手写体另备 GB2312 一级常用汉字（3755 个）作为“扩展”子集，按 unicode-range 拆成几块；
     浏览器只有在页面出现这些字时才会下载对应的那一块。
"""
import re
import sys
from pathlib import Path
from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1] if len(sys.argv) > 1 else "font-src")
OUT = ROOT / "fonts"
HAND_SRC = SRC / "LXGWWenKai-Regular.ttf"
PRINT_SRC = SRC / "NotoSerifSC[wght].ttf"
EXT_CHUNKS = 6
DISPLAY = "作业本阅"          # 封面大字和“阅”字章：最粗的字重，只要这四个字

ALWAYS = (
    "".join(chr(c) for c in range(0x20, 0x7F))
    + "，。、；：？！“”‘’（）《》「」『』…—·〔〕　〇一二三四五六七八九十年月日α"
)


def strip_js_comments(src):
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
    return re.sub(r"(^|[^:\"'])//[^\n]*", r"\1", src)


def page_text():
    """index.html 里会显示出来的字（“来源与说明”那一段用系统字体，不算）+ js 里的字符串。"""
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    html = re.sub(r"<!--.*?-->", "", html, flags=re.S)
    html = re.sub(r'<div class="plain-text credits">.*?</div>', "", html, flags=re.S)
    text = html
    for p in sorted((ROOT / "js").glob("*.js")):
        if p.name != "sky-data.js":
            text += strip_js_comments(p.read_text(encoding="utf-8"))
    return text


def clean(text):
    return {c for c in text if ord(c) >= 0x20 and c not in "\r\n\t"}


def hand_chars():
    cfg = strip_js_comments((ROOT / "content.config.js").read_text(encoding="utf-8"))
    return clean(ALWAYS + cfg + page_text())


def print_chars():
    return clean(ALWAYS + page_text())


def gb2312_level1():
    out = set()
    for hi in range(0xB0, 0xD8):
        for lo in range(0xA1, 0xFF):
            try:
                out.add(bytes([hi, lo]).decode("gb2312"))
            except UnicodeDecodeError:
                pass
    return out


def ranges(chars):
    cps = sorted(ord(c) for c in chars)
    out, start, prev = [], None, None
    for cp in cps:
        if start is None:
            start = prev = cp
        elif cp == prev + 1:
            prev = cp
        else:
            out.append((start, prev)); start = prev = cp
    if start is not None:
        out.append((start, prev))
    return ",".join(f"U+{a:X}" if a == b else f"U+{a:X}-{b:X}" for a, b in out)


def make(src, chars, name, wght=None):
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["kern", "liga", "locl", "ccmp", "mark", "mkmk", "palt", "vert"]
    opts.hinting = False
    opts.desubroutinize = True
    opts.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]
    opts.notdef_outline = True
    font = TTFont(str(src), lazy=True)
    cmap = font.getBestCmap()
    have = {c for c in chars if ord(c) in cmap}
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=[ord(c) for c in have])
    sub.subset(font)
    if wght is not None:                      # 可变字体压成一个固定字重，体积小一半以上
        font = instancer.instantiateVariableFont(font, {"wght": wght})
        font.flavor = "woff2"
    out = OUT / name
    font.save(str(out))
    print(f"  {name}: {len(have)} 字, {out.stat().st_size / 1024:.0f} KB")
    return have


def main():
    OUT.mkdir(exist_ok=True)
    for old in OUT.glob("*.woff2"):
        old.unlink()
    core = hand_chars()
    print(f"手写体用到 {len(core)} 个不同的字符")
    css = ["/* 由 tools/build-fonts.py 生成，请勿手改。字体授权见 fonts/OFL-*.txt */"]

    have = make(HAND_SRC, core, "hand-core.woff2")
    css.append(
        '@font-face{font-family:"Vega Hand";font-style:normal;font-weight:400;font-display:block;'
        f'src:url(hand-core.woff2) format("woff2");unicode-range:{ranges(have)}}}'
    )
    ext = sorted(gb2312_level1() - core)
    size = -(-len(ext) // EXT_CHUNKS)
    for i in range(EXT_CHUNKS):
        chunk = set(ext[i * size:(i + 1) * size])
        if not chunk:
            continue
        got = make(HAND_SRC, chunk, f"hand-ext-{i + 1}.woff2")
        css.append(
            '@font-face{font-family:"Vega Hand";font-style:normal;font-weight:400;font-display:swap;'
            f'src:url(hand-ext-{i + 1}.woff2) format("woff2");unicode-range:{ranges(got)}}}'
        )

    pc = print_chars()
    print(f"印刷体用到 {len(pc)} 个不同的字符")
    have = make(PRINT_SRC, pc, "print-core.woff2", wght=560)
    css.append(
        '@font-face{font-family:"Vega Print";font-style:normal;font-weight:200 799;font-display:block;'
        f'src:url(print-core.woff2) format("woff2");unicode-range:{ranges(have)}}}'
    )
    have = make(PRINT_SRC, set(DISPLAY), "print-display.woff2", wght=900)
    css.append(
        '@font-face{font-family:"Vega Print";font-style:normal;font-weight:800 900;font-display:block;'
        f'src:url(print-display.woff2) format("woff2");unicode-range:{ranges(have)}}}'
    )
    (OUT / "fonts.css").write_text("\n".join(css) + "\n", encoding="utf-8")
    print("已写入 fonts/fonts.css")


if __name__ == "__main__":
    main()
