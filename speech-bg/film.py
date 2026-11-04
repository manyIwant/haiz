#!/usr/bin/env python3
"""
「当我们说"我认为"的时候」 — 全文演讲影片
==========================================

Every sentence of the speech appears on screen, in order, timed to a natural
speaking pace (~4.3 字/秒), and every section has its own visual argument:

  序幕  title rises out of the dark stream
  一    an answer sheet: A filled in pencil, votes pour into B, A trembles,
        the votes blow away, and the same choice splits into different reasons
  二    other people's words drift in and are absorbed by the self; the walls
        close (only trusting myself); a lonely proof of 勾股定理 races the
        高考 countdown; the inherited formula (silver) vs. one's own reasoning (gold)
  三    a belief cracks; two currents collide; a spark; a new conclusion is
        struck out; an infinite regress of doubt; the exam paper is collected
        and only a question mark remains; the current settles into order
  四    blueprint grid, axes, f(x) on x > 0; the domain floods to all of ℝ and
        snaps back; x = −2 hits the boundary; one road becomes many; real
        boundaries (solid) and unquestioned assumptions (dashed) that dissolve
  五    back to the answer sheet; a path that turns, a path that holds through
        a checkpoint; a thread that turns back to look; the final question

Section changes push the camera through the eye (radial motion blur, flash)
and pull back to reveal the section number and title traced in light.

  python3 film.py --fonts DIR stills --t 30,95.5,200
  python3 film.py --fonts DIR render --jobs 4
"""
import argparse
import math
import os
import subprocess
import sys
import time

import cv2
import numpy as np

import filmkit as K
import render as R
from filmkit import FPS, H, W, clamp01, ease, ease_in, ease_out, lerp, rp

PAPER = np.array([0.930, 0.905, 0.860], np.float32)   # display-space colours
GOLD = np.array([0.950, 0.780, 0.470], np.float32)
MIST = np.array([0.700, 0.745, 0.810], np.float32)
REDD = np.array([0.930, 0.470, 0.410], np.float32)
DIMD = np.array([0.520, 0.570, 0.650], np.float32)

ECX, ECY = 960.0, 532.0

# ----------------------------------------------------------------------------
# Script.  style: n = spoken line (focus-in), k = key line (light-pen trace),
#          x = drawn by the scene itself.  {…} marks gold emphasis.
# ----------------------------------------------------------------------------
SECTIONS = [
    ("S1", "01", "多数人的答案", [
        ("s1_01", "同学们，今天我想先请大家做一道选择题。", "n", "lower"),
        ("s1_02", "假设你刚刚完成一道数学选择题，经过认真思考，你选择了 {A}。", "n", "lower"),
        ("s1_03", "但在对答案之前，你发现身边的大多数同学都选择了 {B}。", "n", "lower"),
        ("s1_04", "你会不会开始怀疑自己？", "n", "lower"),
        ("s1_05", "其实，数学题又不是班长选举，B 的票数再多，也不代表 B 就是正确答案。", "n", "lower"),
        ("s1_06", "可我们为什么会动摇呢？", "n", "lower"),
        ("s1_07", "如果你坚持 {A}，是因为相信自己的推理，还是不愿意承认自己可能错了？", "n", "lower"),
        ("s1_08", "如果你改成 {B}，是因为找到了新的理由，还是仅仅因为别人都这么选？", "n", "lower"),
        ("s1_09", "同样的选择，背后可能有完全不同的思考过程。", "n", "lower"),
        ("s1_10", "所以今天，我想讨论一个问题：", "n", "lower"),
        ("s1_11", "当我们说{「我认为」}的时候，究竟有多少思想，真正属于我们自己？", "k", "center"),
    ]),
    ("S2", "02", "我们的思想，真的独立吗？", [
        ("s2_01", "从小到大，我们听过无数句话：", "n", "lower"),
        ("s2_02", "「要努力学习。」", "x", None),
        ("s2_03", "「成绩很重要。」", "x", None),
        ("s2_04", "「考上好大学，未来才会有更多选择。」", "x", None),
        ("s2_05", "这些话不一定错。", "n", "center"),
        ("s2_06", "但我们相信它们，是因为自己认真思考过，还是因为一直有人这样告诉我们？", "n", "center"),
        ("s2_07", "或许有人会说：那我谁都不听，只相信自己，不就独立了吗？", "n", "lower"),
        ("s2_08", "可问题是，一个完全不接受外界知识的人，又能知道些什么呢？", "n", "lower"),
        ("s2_09", "假设我们为了独立思考，连老师教的数学公式都不接受，非要自己重新发明。", "n", "lower"),
        ("s2_10", "那等我们终于推导出勾股定理，可能高考都已经结束了。", "n", "lower"),
        ("s2_11", "所以，一个看似矛盾的事实出现了：", "n", "lower"),
        ("s2_12", "我们必须先{接受}世界的影响，才有能力{反过来}思考世界。", "k", "center"),
        ("s2_13", "但接受影响，{不等于}必须服从影响。", "k", "center"),
        ("s2_14", "我们可以从别人那里获得知识，却通过{自己的判断}决定是否相信它。", "n", "center"),
        ("s2_15", "就像一道数学题，我们使用的是前人创造的公式，但推理的过程，仍然需要{自己完成}。", "n", "lower"),
        ("s2_16", "所以，独立思考并不是拒绝外界，而是学会{审视}外界带给我们的东西。", "k", "center"),
    ]),
    ("S3", "03", "独立思考，就是不断怀疑吗？", [
        ("s3_01", "假设有一个同学，始终相信：", "n", "lower"),
        ("s3_02", "「只要足够努力，就一定能够考好。」", "x", None),
        ("s3_03", "可有一次，他认真复习了很久，成绩却没有达到预期。", "n", "lower"),
        ("s3_04", "于是他开始怀疑：努力真的一定能换来好成绩吗？", "n", "lower"),
        ("s3_05", "他可能从未听过什么相反的理论，只是发现现实与自己原有的观念发生了冲突。", "n", "lower"),
        ("s3_06", "这就是独立思考的一种{起点}。", "k", "center"),
        ("s3_07", "但如果他因此得出一个新结论：", "n", "lower"),
        ("s3_08", "「既然努力不保证成功，那努力就没有意义。」", "x", None),
        ("s3_09", "这个结论就一定正确吗？当然不是。", "n", "lower"),
        ("s3_10", "所以，我们不能只怀疑过去的观点，还需要检验自己新得出的判断。", "n", "lower"),
        ("s3_11", "可这样一来，我们岂不是要怀疑观点，怀疑理由，再怀疑自己怀疑理由的理由？", "n", "lower"),
        ("s3_12", "再这样怀疑下去，恐怕试卷都收上去了，我们还在怀疑名字是不是自己写的。", "n", "lower"),
        ("s3_13", "所以我想说：", "n", "center"),
        ("s3_14", "怀疑不是目的，{理解}才是；否定不是终点，{完善}才是。", "k", "center"),
        ("s3_15", "独立思考不是为了证明别人错误，也不是为了显得与众不同。", "n", "center"),
        ("s3_16", "而是让我们相信一件事时，{知道自己为什么相信它}。", "k", "center"),
    ]),
    ("S4", "04", "定义域与自由", [
        ("s4_01", "可是，为什么要这么费力地思考呢？", "n", "center"),
        ("s4_02", "我们不妨从数学课里寻找一点答案。", "n", "lower"),
        ("s4_03", "最近我们学到了函数的{定义域}。", "n", "lower"),
        ("s4_04", "假设一道题规定，{x > 0}。", "n", "lower"),
        ("s4_05", "但你没注意到这个条件，以为 x 可以取任何实数。", "n", "lower"),
        ("s4_06", "这样做题是不是轻松多了？", "n", "lower"),
        ("s4_07", "不用考虑范围，不用检查答案，想怎么算就怎么算。", "n", "lower"),
        ("s4_08", "这其实也符合人类趋利避害的天性。", "n", "lower"),
        ("s4_09", "毕竟，谁不想走狗屎运呢？可谁又想真的踩到狗屎呢？", "b", "lower"),
        ("s4_10", "可是，数学题不会因为你希望条件宽松，就真的放宽条件。", "n", "lower"),
        ("s4_11", "如果你算出了 {x = −2}，它会因为你不知道定义域的限制，就变成正确答案吗？", "n", "lower"),
        ("s4_12", "当然不会。", "n", "lower"),
        ("s4_13", "{不知道边界}，不代表{边界不存在}。", "k", "lower"),
        ("s4_14", "生活也是如此。", "n", "center"),
        ("s4_15", "假设一个同学从小认为，自己将来只有{一条}升学道路可以选择。", "n", "lower"),
        ("s4_16", "他从未了解过其他可能，也从不觉得受到限制。", "n", "lower"),
        ("s4_17", "直到有一天，他发现原来还有{不同的道路}。", "n", "lower"),
        ("s4_18", "他开始犹豫、迷茫，甚至为选择而烦恼。", "n", "lower"),
        ("s4_19", "那么，他究竟是更自由了，还是更不自由了？", "n", "lower"),
        ("s4_20", "过去，他不知道还有其他可能，所以觉得没有什么需要选择。", "n", "lower"),
        ("s4_21", "现在，他知道得更多了，却反而开始烦恼。", "n", "lower"),
        ("s4_22", "但至少有一点发生了变化：", "n", "lower"),
        ("s4_23", "他开始意识到，自己曾经以为的{唯一选择}，也许并不是唯一的。", "n", "lower"),
        ("s4_24", "当然，人生并不完全是一道数学题。", "n", "center"),
        ("s4_25", "数学的定义域可以明确写在纸上，而人生的边界，有些{确实存在}，有些却只是我们从未质疑过的{假设}。", "n", "lower"),
        ("s4_26", "独立思考的意义，或许就在于帮助我们{分清它们}。", "n", "lower"),
        ("s4_27", "{认识局限}，可能减少自由的感觉，却也增加了获得自由的{可能}。", "k", "center"),
    ]),
    ("S5", "05", "回到最初的选择", [
        ("s5_01", "现在，让我们回到开头那道选择题。", "n", "lower"),
        ("s5_02", "你选了 {A}，大多数同学选了 B。", "n", "lower"),
        ("s5_03", "你还会坚持吗？", "n", "lower"),
        ("s5_04", "其实，坚持 A 不一定意味着独立，改成 B 也不一定意味着盲从。", "n", "lower"),
        ("s5_05", "真正重要的，是你{为什么}作出这个决定。", "k", "center"),
        ("s5_06", "发现自己错了，改变观点{不是屈服}。", "n", "lower"),
        ("s5_07", "经过检验仍然相信自己，坚持观点{也不是固执}。", "n", "lower"),
        ("s5_08", "我们无法摆脱世界对我们的所有影响，也不可能永远作出正确的判断。", "n", "center"),
        ("s5_09", "但至少，我们可以不把{习惯}当成真理，不把{多数人的选择}当成自己的答案。", "k", "center"),
        ("s5_10", "独立思考，不是站在世界之外思考，而是在世界塑造了我们之后，仍然愿意{回过头来}，审视世界，也{审视自己}。", "k", "center"),
        ("s5_11", "最后，我想再问大家一次：", "n", "center"),
        ("s5_12", "当我们说「我认为」的时候——", "x", None),
        ("s5_13", "我们真的知道，自己为什么这样认为吗？", "x", None),
        ("s5_14", "谢谢大家。", "x", None),
    ]),
]
EXTRA = {"s2_02": 0.6, "s2_03": 0.6, "s2_04": 0.6, "s3_02": 1.0, "s3_08": 0.8, "s2_10": 1.0, "s3_11": 1.2,
         "s3_12": 1.4, "s4_09": 0.6, "s4_11": 0.6, "s5_10": 1.2, "s5_12": 0.8, "s5_13": 3.0, "s5_14": 8.5,
         "s1_03": 0.8, "s2_09": 0.8, "s4_17": 0.6, "s1_11": 0.6}

PROLOGUE = 14.9          # flash into section 1
HEAD = 5.4               # heading card before the first beat
WARP_OUT = 1.3
WARP_IN = 1.5

STYLES = {
    "n": dict(face="medium", size=48, tracking=0.05, maxc=20),
    "b": dict(face="medium", size=48, tracking=0.05, maxc=20),
    "k": dict(face="semibold", size=60, tracking=0.07, maxc=15),
}
POS_Y = {"center": 534.0, "lower": 884.0}


class Beat:
    pass


class Section:
    pass


class Timeline:
    def __init__(self, faces):
        self.faces = faces
        self.sections, self.beats, self.beat = [], [], {}
        t = PROLOGUE
        for si, (key, num, title, beats) in enumerate(SECTIONS):
            s = Section()
            s.key, s.num, s.title, s.idx = key, num, title, si
            s.t0 = t
            bt = t + HEAD
            s.beats = []
            for (bk, text, style, pos) in beats:
                b = Beat()
                b.key, b.style, b.pos, b.sec = bk, style, pos, s
                b.text, b.mask = K.parse_markup(text)
                n = len(b.text.replace(" ", ""))
                d = 1.15 + n / 4.3
                if b.text.endswith("？"):
                    d += 0.5
                if style == "k":
                    d += 1.2
                d += EXTRA.get(bk, 0.0)
                b.start, b.end, b.dur = bt, bt + d, d
                bt += d
                if style in STYLES:
                    st = STYLES[style]
                    lines = K.wrap(b.text, b.mask, st["maxc"])
                    size = st["size"] * (0.9 if len(lines) > 2 else 1.0)
                    if style == "k" and len(lines) > 3:             # long key line: wider, smaller
                        lines = K.wrap(b.text, b.mask, 21)
                        size = 50
                    cy = POS_Y[pos] - (16 if (pos == "lower" and len(lines) > 2) else 0)
                    b.glyphs = K.text_block(faces[st["face"]], lines, size, st["tracking"], 960.0, cy)
                    b.nlines = len(lines)
                self.beat[bk] = b
                self.beats.append(b)
                s.beats.append(b)
            s.t_end = bt + 0.25
            t = s.t_end + WARP_OUT
            self.sections.append(s)
        self.total = self.sections[-1].t_end
        for i, s in enumerate(self.sections):
            s.t1 = self.sections[i + 1].t0 if i + 1 < len(self.sections) else self.total

    def section_at(self, t):
        cur = None
        for s in self.sections:
            if t >= s.t0:
                cur = s
        return cur

    def beat_at(self, t):
        for b in self.beats:
            if b.start <= t < b.end:
                return b
        return None


# ----------------------------------------------------------------------------
# Frame context: collects vector ink, emissive graphics, display overlays
# ----------------------------------------------------------------------------
class Ctx:
    def __init__(self, f, t, P, faces):
        self.f, self.t, self.P, self.faces = f, t, P, faces
        self.ink = K.Ink()
        self._gfx = None
        self.disp = []

    @property
    def gfx(self):
        if self._gfx is None:
            self._gfx = [np.zeros((H, W), np.float32) for _ in range(3)]
        return self._gfx


_text_cache = {}


def T(faces, face, text, size, cx, baseline, tracking=0.04, align="center", x0=None, gold=None):
    key = (face, text, size, round(cx, 2), round(baseline, 2), tracking, align, x0, None if gold is None else tuple(gold))
    g = _text_cache.get(key)
    if g is None:
        if len(_text_cache) > 4000:
            _text_cache.clear()
            _line_cache.clear()
        g, _ = K.layout(faces[face], text, size, tracking, cx, baseline, gold, align, x0)
        for gg in g:
            K.glyph_tile(gg)
        _text_cache[key] = g
    return g


_line_cache = {}


def line_tile(glyphs):
    """Merge glyph tiles into one alpha tile (for moving/scaling/cracking a line)."""
    key = id(glyphs)
    c = _line_cache.get(key)
    if c is not None:
        return c
    tiles = [K.glyph_tile(g) for g in glyphs]
    tiles = [x for x in tiles if x[0] is not None]
    x0 = min(t[1] for t in tiles)
    y0 = min(t[2] for t in tiles)
    x1 = max(t[1] + t[0].shape[1] for t in tiles)
    y1 = max(t[2] + t[0].shape[0] for t in tiles)
    a = np.zeros((y1 - y0, x1 - x0), np.float32)
    for (tt, ox, oy) in tiles:
        reg = a[oy - y0:oy - y0 + tt.shape[0], ox - x0:ox - x0 + tt.shape[1]]
        np.maximum(reg, tt, out=reg)
    c = (a, x0, y0)
    _line_cache[key] = c
    return c


def put(planes, a, ox, oy, alpha, color, blur=0.0, glow=0.0, scale=1.0, mode="over", rot=0.0):
    """Place an alpha tile at a float position (sub-pixel), with optional scale
    and rotation about its centre, defocus and glow."""
    if a is None or alpha <= 0.003:
        return
    h0, w0 = a.shape
    if abs(scale - 1.0) > 1e-3 or abs(rot) > 1e-3 or (ox % 1) or (oy % 1):
        pad = 2
        nw = int(math.ceil(w0 * scale)) + 2 * pad + 2
        nh = int(math.ceil(h0 * scale)) + 2 * pad + 2
        cxs, cys = w0 / 2.0, h0 / 2.0
        tx = ox + cxs - (w0 * scale) / 2.0          # top-left of scaled tile (float)
        ty = oy + cys - (h0 * scale) / 2.0
        ix, iy = math.floor(tx) - pad, math.floor(ty) - pad
        M = cv2.getRotationMatrix2D((cxs, cys), rot, scale)
        M[0, 2] += (tx - ix) + (w0 * scale) / 2.0 - cxs
        M[1, 2] += (ty - iy) + (h0 * scale) / 2.0 - cys
        a = cv2.warpAffine(a, M, (nw, nh), flags=cv2.INTER_LINEAR if scale >= 0.7 else cv2.INTER_AREA)
        ox, oy = ix, iy
    K.blit(planes, a, int(ox), int(oy), alpha, color, 0.0, blur, glow, 1.0, mode)


def put_glyphs(planes, glyphs, alpha, color, dx=0.0, dy=0.0, blur=0.0, glow=0.0, mode="over"):
    for g in glyphs:
        a, ox, oy = K.glyph_tile(g)
        put(planes, a, ox + dx, oy + dy, alpha, color, blur, glow, 1.0, mode)


LIN = {k: np.array(v, np.float32) for k, v in K.COL.items()}


def gtext(C, glyphs, color, alpha, dx=0.0, dy=0.0, blur=0.0, gain=0.55):
    """Emissive text in linear light (glows with the bloom)."""
    put_glyphs(C.gfx, glyphs, alpha * gain, LIN[color] if isinstance(color, str) else color, dx, dy, blur, 0.0, "add")


def dtext(C, glyphs, color, alpha, dx=0.0, dy=0.0, blur=0.0, glow=0.0):
    """Crisp display-space text (drawn after tone mapping)."""
    C.disp.append(lambda pl: put_glyphs(pl, glyphs, alpha, color, dx, dy, blur, glow, "over"))


def dtile(C, tile, alpha, color, dx=0.0, dy=0.0, blur=0.0, glow=0.0, scale=1.0, rot=0.0):
    a, ox, oy = tile
    C.disp.append(lambda pl: put(pl, a, ox + dx, oy + dy, alpha, color, blur, glow, scale, "over", rot))


def gtile(C, tile, alpha, color, dx=0.0, dy=0.0, blur=0.0, scale=1.0, rot=0.0, gain=0.55):
    a, ox, oy = tile
    put(C.gfx, a, ox + dx, oy + dy, alpha * gain, LIN[color] if isinstance(color, str) else color,
        blur, 0.0, scale, "add", rot)


def noise1(t, seed=0.0):
    return (math.sin(t * 7.13 + seed) * 0.5 + math.sin(t * 11.7 + seed * 2.1) * 0.3 +
            math.sin(t * 19.3 + seed * 3.7) * 0.2)


# ----------------------------------------------------------------------------
# Shared drawings
# ----------------------------------------------------------------------------
def eye_rings(C, f, alpha):
    P = C.P
    cx, cy, a, b, s = K.eye_geom(P)
    if alpha <= 0.01 or s < 0.3:
        return
    v = alpha * clamp01((s - 0.3) / 0.7)
    ph = (f % R.LOOP) / R.LOOP
    start = 360.0 * ph + 205.0
    C.ink.arc("silver", (cx, cy), a, b, start, start + 300.0, 255 * v * 0.55)
    per = 3.0
    rot = -5 * per * ph
    for d in range(120):
        q = d * per + rot
        C.ink.arc("dim", (cx, cy), a * 0.952, b * 0.93, q, q + per * 0.22, 255 * v)
    for sx in (-1, 1):
        C.ink.line("silver", (cx + sx * (a + 10), cy), (cx + sx * (a + 34), cy), 255 * v * 0.7)
    for sy in (-1, 1):
        C.ink.line("silver", (cx, cy + sy * (b - 6)), (cx, cy + sy * (b - 16)), 255 * v * 0.7)


def caption(C, b, t, faces):
    """Spoken lines: focus-in (n), light-pen trace (k), playful hop (b)."""
    if b.style not in STYLES:
        return
    o = 1.0 - rp(t, b.end - 0.5, 0.45)
    if o <= 0.0:
        return
    s0 = b.start
    oblur = 5.0 * (1 - o)
    ody = -10.0 * (1 - o)
    gl = b.glyphs
    n = len(gl)
    if b.style in ("n", "b"):
        stg = min(0.03, 1.1 / max(n, 1))
        for g in gl:
            p = ease_out((t - s0 - 0.10 - g.idx * stg) / 0.7)
            if p <= 0:
                continue
            dy = 14.0 * (1 - p) + ody
            if b.style == "b":
                # each character hops once as the line is spoken
                ph = (t - s0 - 0.4) * 4.3 - g.idx
                if 0 < ph < 1:
                    dy -= 12.0 * math.sin(math.pi * ph)
            col = GOLD if g.gold else PAPER
            a, ox, oy = K.glyph_tile(g)
            C.disp.append(lambda pl, a=a, ox=ox, oy=oy, al=p * o, col=col, dy=dy, bl=6.0 * (1 - p) ** 1.5 + oblur,
                          gw=(0.22 if g.gold else 0.06):
                          put(pl, a, ox, oy + dy, al, col, bl, gw))
    else:  # key: light-pen trace, then fill, then emphasis warms to gold
        for li in range(b.nlines):
            lt0 = s0 + 0.10 + li * 0.32
            lg = [g for g in gl if g.line == li]
            tp = ease((t - lt0) / 1.25)
            tv = (1.0 - rp(t, lt0 + 1.6, 0.9)) * o
            if tp > 0 and tv > 0:
                K.trace_glyphs(C.ink, "paper", [g for g in lg if not g.gold], tp, 255 * tv, 1.0, "hot", 200 * tv)
                K.trace_glyphs(C.ink, "gold", [g for g in lg if g.gold], tp, 255 * tv, 1.0, "hot", 255 * tv)
            fp = ease((t - lt0 - 0.65) / 0.85)
            if fp <= 0:
                continue
            warm = ease((t - lt0 - 1.35) / 0.9)
            pulse = math.exp(-((t - lt0 - 2.0) / 0.7) ** 2)
            for g in lg:
                col = PAPER * (1 - warm) + GOLD * warm if g.gold else PAPER
                gw = (0.30 * warm + 0.55 * pulse) if g.gold else 0.08
                a, ox, oy = K.glyph_tile(g)
                C.disp.append(lambda pl, a=a, ox=ox, oy=oy, al=fp * o, col=col, gw=gw, bl=oblur, dy=ody:
                              put(pl, a, ox, oy + dy, al, col, bl, gw))


# ---- answer-sheet bubbles (sections 1 and 5) -------------------------------
BUB_X = [690.0, 870.0, 1050.0, 1230.0]
BUB_Y = 330.0
BUB_R = 50.0


def _vote_layout():
    rng = np.random.default_rng(7)
    votes = []
    counts = [1, 36, 3, 2]
    for bi, n in enumerate(counts):
        for k in range(n):
            col, row = k % 6, k // 6
            tx = BUB_X[bi] + (col - 2.5) * 18.0 if n > 1 else BUB_X[bi]
            if n <= 3:
                tx = BUB_X[bi] + (k - (n - 1) / 2) * 18.0
                row = 0
            ty = BUB_Y + BUB_R + 34 + row * 18.0
            sx = rng.uniform(-120, 300)
            sy = rng.uniform(150, 950)
            votes.append(dict(b=bi, tx=tx, ty=ty, sx=sx, sy=sy, d=rng.uniform(0, 1), vx=rng.uniform(4, 11),
                              vy=rng.uniform(-3, 3), spin=rng.uniform(0, 1)))
    return votes


VOTES = _vote_layout()


def scribble(c, r, n=11):
    """Pencil fill of an answer bubble: a zig-zag hatch inside the circle."""
    pts = []
    for i in range(n):
        y = -r * 0.78 + (2 * r * 0.78) * i / (n - 1)
        hw = math.sqrt(max(r * r * 0.72 - y * y, 0))
        a = (-hw, y) if i % 2 == 0 else (hw, y)
        b = (hw, y + r * 0.08) if i % 2 == 0 else (-hw, y + r * 0.08)
        pts += [a, b]
    pts = np.array(pts) + np.asarray(c)
    return K.with_cum(pts)


def bubbles(C, faces, t, vis, posx=None, fillA=0.0, trembleA=0.0, dimCD=1.0, draw_prog=1.0, glowA=0.0):
    """Four answer bubbles A–D with letters; A can be pencil-filled and tremble."""
    if vis <= 0.01:
        return
    xs = posx or BUB_X
    for i, L in enumerate("ABCD"):
        x = xs[i]
        y = BUB_Y
        al = vis * (dimCD if i >= 2 else 1.0)
        if al <= 0.01:
            continue
        if i == 0 and trembleA > 0:
            x += trembleA * 5.0 * noise1(t * 3.0, 1.0)
            y += trembleA * 3.0 * noise1(t * 3.0, 4.0)
        prog = clamp01(draw_prog * 1.25 - i * 0.08)
        name = "gold" if (i == 0 and fillA > 0) else "silver"
        C.ink.arc(name, (x, y), BUB_R, BUB_R, -90, -90 + 360 * prog, 255 * al, 1.3)
        g = T(faces, "regular", L, 46, 0.0, 16.0)
        if i == 0 and fillA > 0:
            pts, cum = scribble((x, y), BUB_R)
            C.ink.partial("gold", pts, cum, fillA, 200 * al, 2.6)
            gtext(C, g, "hot", al * (0.6 + 0.4 * fillA) + glowA, dx=x, dy=y, gain=0.9)
        else:
            gtext(C, g, "silver", al * prog, dx=x, dy=y, gain=0.8)


def votes_draw(C, t, t_in, t_scatter, vis, keepA=True, speed=1.0):
    """Votes fly in from the stream and pile up under each bubble; later the
    pile under B (and C, D) is blown back into the current."""
    if vis <= 0.01:
        return
    for v in VOTES:
        t_l = t_in + v["d"] * 2.2 / speed + (0.0 if v["b"] == 0 else 0.25)
        k = ease((t - t_l) / (1.1 / speed))
        if k <= 0:
            continue
        p0 = np.array([v["sx"], v["sy"]])
        p3 = np.array([v["tx"], v["ty"]])
        p1 = p0 + [260, -40]
        p2 = p3 + [0, 120]
        pts = K.bezier(p0, p1, p2, p3, 40)
        idx = k * 39
        i0 = int(idx)
        pos = pts[min(i0, 39)] if i0 >= 39 else pts[i0] + (pts[i0 + 1] - pts[i0]) * (idx - i0)
        name = "gold" if v["b"] == 0 else "silver"
        al = vis
        if t_scatter is not None and not (keepA and v["b"] == 0):
            s = t - (t_scatter + v["d"] * 0.8)
            if s > 0:
                pos = pos + np.array([v["vx"] * s * 60 + 20 * s * s * 60, v["vy"] * s * 40 - 30 * s * s])
                al *= max(0.0, 1.0 - s / 1.6)
        if al <= 0.01:
            continue
        if k < 1:
            tail = pts[max(0, i0 - 8):i0 + 1]
            if len(tail) > 1:
                C.ink.polyline(name, tail, 120 * al, 1.0)
        C.ink.circle(name if v["b"] else "hot", pos, 5.2 if v["b"] == 0 else 4.4, 255 * al, fill=True)


def branch(C, faces, t0, t, p0, p1, label, color, vis, size=30):
    """A curved line from a choice down to the reason behind it."""
    if vis <= 0.01:
        return
    pts, cum = K.with_cum(K.bezier(p0, (p0[0], p0[1] + 110), (p1[0], p1[1] - 120), p1, 50))
    pr = ease((t - t0) / 0.9)
    C.ink.partial("gold" if color == "gold" else "silver", pts, cum, pr, 255 * vis, 1.2)
    lp = ease((t - t0 - 0.6) / 0.7)
    g = T(faces, "regular", label, size, p1[0], p1[1] + 38)
    gtext(C, g, "hot" if color == "gold" else "silver", vis * lp, dy=8 * (1 - lp), blur=4 * (1 - lp), gain=0.85)


# ----------------------------------------------------------------------------
# Scenes
# ----------------------------------------------------------------------------
class Scene:
    def __init__(self, tl, sec, faces):
        self.tl, self.sec, self.faces = tl, sec, faces

    def s(self, k):
        return self.tl.beat[k].start

    def e(self, k):
        return self.tl.beat[k].end

    def d(self, k):
        return self.tl.beat[k].dur

    def at(self, k, frac):
        b = self.tl.beat[k]
        return b.start + b.dur * frac

    def win(self, t, k0, k1, fin=0.8, fout=0.8, a0=0.0, a1=0.0):
        """Visibility from beat k0 start (+a0) to beat k1 end (+a1)."""
        return rp(t, self.s(k0) + a0, fin) * (1.0 - rp(t, self.e(k1) + a1 - fout, fout))

    def lower(self, t, P):
        b = self.tl.beat_at(t)
        if b is not None and b.pos == "lower" and b.sec is self.sec:
            P["scrim"] = max(P.get("scrim", 0.0), rp(t, b.start - 0.3, 0.5) * (1 - rp(t, b.end - 0.3, 0.4)))

    def params(self, t, P):
        pass

    def draw(self, C, t, f):
        pass


class S1(Scene):
    def params(self, t, P):
        off = rp(t, self.s("s1_01") - 0.2, 1.6)
        back = rp(t, self.s("s1_11") - 0.6, 1.4)
        P["eye_on"] = 1.0 - off + back
        P["sgain"] = 1.0 - 0.25 * off * (1 - back)
        P["ring"] = 1.0 - off + back
        self.lower(t, P)

    def draw(self, C, t, f):
        fc = self.faces
        vis = rp(t, self.s("s1_01") + 0.4, 1.0) * (1 - rp(t, self.s("s1_10") + 0.2, 1.0))
        spread = rp(t, self.s("s1_07") - 0.3, 1.1)
        xs = [lerp(BUB_X[0], 640, spread), lerp(BUB_X[1], 1280, spread), BUB_X[2], BUB_X[3]]
        fillA = ease((t - self.at("s1_02", 0.62)) / 0.9)
        tremble = (math.exp(-((t - self.at("s1_04", 0.45)) / 0.9) ** 2) +
                   0.8 * math.exp(-((t - self.at("s1_06", 0.5)) / 0.8) ** 2))
        drawp = ease((t - self.s("s1_01") - 0.5) / 1.4)
        bubbles(C, fc, t, vis, xs, fillA, tremble, 1.0 - spread, drawp)
        vv = vis * (1 - rp(t, self.s("s1_07") - 0.5, 0.6))
        votes_draw(C, t, self.s("s1_03") + 0.3, self.at("s1_05", 0.45), vv)
        # the same choice, different reasons
        bv = rp(t, self.s("s1_07"), 0.5) * (1 - rp(t, self.s("s1_10") + 0.2, 1.0))
        pulse = 1.0 + 0.35 * math.exp(-((t - self.at("s1_09", 0.4)) / 0.8) ** 2)
        A0 = (xs[0], BUB_Y + BUB_R + 8)
        B0 = (xs[1], BUB_Y + BUB_R + 8)
        branch(C, fc, self.at("s1_07", 0.30), t, A0, (500.0, 600.0), "相信自己的推理", "gold", bv * pulse)
        branch(C, fc, self.at("s1_07", 0.62), t, A0, (790.0, 600.0), "不愿承认错了", "silver", bv * pulse)
        branch(C, fc, self.at("s1_08", 0.30), t, B0, (1140.0, 600.0), "找到新的理由", "gold", bv * pulse)
        branch(C, fc, self.at("s1_08", 0.62), t, B0, (1430.0, 600.0), "别人都这么选", "silver", bv * pulse)


class S2(Scene):
    ECHO = ["要努力学习", "成绩很重要", "考上好大学", "听话", "别想太多", "大家都这样", "这样才对", "要合群",
            "别走弯路", "多数人都这么选", "先把题做对", "未来会有更多选择", "别人家的孩子", "按部就班",
            "照着做就好", "这是为你好", "要稳妥", "随大流不会错"]

    def __init__(self, *a):
        super().__init__(*a)
        rng = np.random.default_rng(22)
        self.quotes = [("s2_02", "「要努力学习。」", 470.0, 250.0), ("s2_03", "「成绩很重要。」", 1450.0, 300.0),
                       ("s2_04", "「考上好大学，未来才会有更多选择。」", 960.0, 806.0)]
        boxes = [(170, 190, 770, 310), (1150, 240, 1750, 360), (480, 750, 1440, 870), (340, 340, 1580, 720),
                 (60, 50, 600, 120)]
        self.echo = []
        for txt in self.ECHO + self.ECHO[:6]:
            sz = float(rng.choice([22, 24, 26, 28]))
            for _ in range(400):
                x, y = rng.uniform(80, 1700), rng.uniform(110, 1010)
                bw = sz * len(txt) * 1.08 + 120          # room to drift right
                bx = (x - 10, y - sz - 12, x + bw, y + 14)
                if all(bx[2] < b[0] or bx[0] > b[2] or bx[3] < b[1] or bx[1] > b[3] for b in boxes):
                    boxes.append(bx)
                    self.echo.append(dict(txt=txt, x=x, y=y, s=sz, d=rng.uniform(0, 1), a=rng.uniform(0.28, 0.5),
                                          vx=rng.uniform(0.12, 0.3)))
                    break
        tri0 = np.array([650.0, 500.0])
        self.P0, self.P1, self.P2 = tri0, tri0 + [213.3, 0], tri0 + [0, -160]

    def params(self, t, P):
        small = rp(t, self.s("s2_01") - 0.3, 1.4)
        P["eye_a"] = lerp(705, 430, small)
        P["eye_b"] = lerp(212, 165, small)
        wall = rp(t, self.s("s2_07") + 0.2, 1.4)
        P["eye_a"] = lerp(P["eye_a"], 205, wall)
        P["eye_b"] = lerp(P["eye_b"], 205, wall)
        P["eye_cy"] = lerp(532, 470, wall)
        off = rp(t, self.s("s2_09") + 0.2, 1.2)
        back = rp(t, self.s("s2_12") - 0.7, 1.3)
        P["eye_on"] = 1.0 - off + back
        P["eye_a"] = lerp(P["eye_a"], 705, back)
        P["eye_b"] = lerp(P["eye_b"], 212, back)
        P["eye_cy"] = lerp(P["eye_cy"], 532, back)
        P["sgain"] = 1.0 - 0.35 * off * (1 - back)
        gold = math.exp(-((t - self.at("s2_13", 0.5)) / 2.2) ** 2)
        P["hgain"] = 1.0 + 1.6 * gold
        P["ggain"] = 1.0 + 1.2 * gold
        f2 = rp(t, self.s("s2_15") - 0.3, 0.9) * (1 - rp(t, self.s("s2_16") - 0.6, 1.0))
        P["eye_on"] *= (1 - f2)
        P["ring"] = P["eye_on"] * (1 - wall * (1 - back))
        self.lower(t, P)

    def draw(self, C, t, f):
        fc = self.faces
        # --- the voices -------------------------------------------------------
        absorb_t = self.at("s2_06", 0.35)
        ev = rp(t, self.s("s2_01") + 0.3, 1.0)
        if ev > 0 and t < absorb_t + 3.5:
            for i, e in enumerate(self.echo):
                appear = self.s("s2_01") + 0.3 + e["d"] * (self.e("s2_04") - self.s("s2_01"))
                a = rp(t, appear, 0.9) * e["a"]
                x = e["x"] + (t - appear) * e["vx"] * FPS
                y = e["y"]
                k = ease((t - absorb_t - e["d"] * 1.2) / 1.6)
                if k > 0:
                    x, y = lerp(x, ECX, k), lerp(y, ECY, k)
                    a *= 1 - k
                if a > 0.01:
                    g = T(fc, "light", e["txt"], e["s"], 0, 0, 0.06, "left", 0.0)
                    gtile(C, line_tile(g), a, "silver", dx=x, dy=y, gain=0.7, scale=1 - 0.6 * k)
        for (bk, txt, qx, qy) in self.quotes:
            p = ease_out((t - self.s(bk) - 0.1) / 1.0)
            if p <= 0:
                continue
            g = T(fc, "regular", txt, 50, qx, qy + 18, 0.06)
            k = ease((t - absorb_t - 0.4) / 1.8)
            a = p * (1 - k)
            if a <= 0.01:
                continue
            tl = line_tile(g)
            cx0 = tl[1] + tl[0].shape[1] / 2
            cy0 = tl[2] + tl[0].shape[0] / 2
            dx = (ECX - cx0) * k
            dy = (ECY - cy0) * k + 12 * (1 - p)
            hl = 1.0 + 0.5 * math.exp(-((t - self.s(bk) - 0.9) / 0.6) ** 2)
            dtile(C, tl, a * 0.92, PAPER * min(1, hl), dx, dy, 6 * (1 - p), 0.12 * hl, scale=1 - 0.7 * k)
        # --- the wall ------------------------------------------------------------
        wv = rp(t, self.s("s2_07") + 0.6, 1.0) * (1 - rp(t, self.s("s2_09") + 0.2, 0.9))
        if wv > 0:
            c = (ECX, 470.0)
            for i, r in enumerate((222, 236, 250)):
                pr = ease((t - self.s("s2_07") - 0.6 - i * 0.25) / 1.2)
                C.ink.arc("paper", c, r, r, -90, -90 + 360 * pr, 255 * wv * (0.75 - i * 0.18), 1.2 + 0.6 * (2 - i))
            dim = 1 - 0.75 * rp(t, self.s("s2_08") + 0.5, 1.5)
            C.ink.circle("hot", c, 5.0, 255 * wv * dim, fill=True)
            g = T(fc, "regular", "我", 28, c[0], c[1] + 44)
            gtext(C, g, "paper", wv * dim, gain=0.8)
            q = rp(t, self.s("s2_08") + 1.2, 1.4)
            g2 = T(fc, "light", "？", 150, c[0] + 8, c[1] + 40)
            gtext(C, g2, "dim", wv * q * 0.9, gain=1.0)
        # --- 勾股定理 vs. the 高考 countdown ------------------------------------------
        pv = rp(t, self.s("s2_09") + 0.5, 0.8) * (1 - rp(t, self.s("s2_11") + 0.2, 0.9))
        if pv > 0:
            self.pythagoras(C, t, pv)
        # --- formula vs. reasoning --------------------------------------------------
        fv = rp(t, self.s("s2_15") + 0.1, 0.8) * (1 - rp(t, self.e("s2_15") - 0.4, 0.8))
        if fv > 0:
            self.formula(C, t, fv)

    def pythagoras(self, C, t, vis):
        fc = self.faces
        P0, P1, P2 = self.P0, self.P1, self.P2
        t9, t10 = self.s("s2_09"), self.s("s2_10")
        slow = (t - t9 - 0.8) / (self.d("s2_09") + 2.0)          # laborious: never quite done in s2_09
        done = ease((t - self.at("s2_10", 0.15)) / (self.d("s2_10") * 0.45))
        prog = clamp01(max(0.0, slow) * 0.62 + done * 0.38 + (0.0 if done < 1 else 1.0))
        n = P1 - P2
        n = np.array([n[1], -n[0]])                               # outward normal of the hypotenuse
        segs = [
            [P0, P1], [P0, P2], [P2, P1],                                       # triangle
            [P2, P2 + [-160, 0], P0 + [-160, 0], P0],                           # square on a
            [P0, P0 + [0, 213.3], P1 + [0, 213.3], P1],                         # square on b
            [P2, P2 + n, P1 + n, P1],                                           # square on c
        ]
        gold = rp(t, self.at("s2_10", 0.6), 0.6)
        for i, sgm in enumerate(segs):
            pts, cum = K.with_cum(np.array(sgm, float))
            k = clamp01(prog * len(segs) - i)
            if k > 0:
                jitter = (1 - done) * 1.5
                pts = pts + np.array([[noise1(t * 2 + j, i) * jitter, noise1(t * 2 + j, i + 5) * jitter]
                                      for j in range(len(pts))])
                C.ink.partial("silver", pts, cum, k, 255 * vis * (1 - gold), 1.2)
                if gold > 0:
                    C.ink.partial("gold", pts, cum, k, 255 * vis * gold, 1.3)
        for lab, p in (("a", P0 + [-22, -70]), ("b", P0 + [106, 34]), ("c", (P1 + P2) / 2 + [-22, -14])):
            g = T(fc, "regular", lab, 30, p[0], p[1])
            gtext(C, g, "paper", vis * clamp01(prog * 3), gain=0.6)
        fm = T(fc, "regular", "a² + b² = c²", 42, float((P2 + P1 + n)[0] / 2 + 10), float((P2 + P1 + n)[1] / 2 + 14))
        fp = ease((t - self.at("s2_10", 0.5)) / 1.0)
        if fp > 0:
            K.trace_glyphs(C.ink, "gold", fm, fp, 255 * vis * (1 - rp(t, self.at("s2_10", 0.5) + 1.3, 0.6)), 1.0,
                           "hot", 255 * vis)
            gtext(C, fm, "hot", vis * ease((t - self.at("s2_10", 0.5) - 0.7) / 0.6), gain=0.9)
        # countdown: 365 days crawl, then race to zero as the proof is finished
        c0 = (1440.0, 470.0)
        days = 365 - 60 * clamp01((t - t9 - 0.6) / (self.d("s2_09")))
        race = clamp01((t - t10 - 0.2) / (self.d("s2_10") * 0.5))
        days = days * (1 - ease_in(race))
        dn = int(math.ceil(days))
        g = T(self.faces, "regular", "距离高考", 30, c0[0], c0[1] - 110, 0.2)
        gtext(C, g, "silver", vis, gain=0.8)
        num = T(self.faces, "semibold", f"{dn}", 128, c0[0], c0[1] + 30, 0.02)
        hot = rp(t, self.at("s2_10", 0.5), 0.3)
        gtext(C, num, "paper" if hot < 0.5 else "red", vis, gain=0.75)
        g = T(self.faces, "regular", "天", 30, c0[0], c0[1] + 90)
        gtext(C, g, "silver", vis, gain=0.8)
        # the stamp
        st = t - self.at("s2_10", 0.56)
        if st > 0:
            sc = 1.0 + 0.5 * math.exp(-st * 9.0) * math.cos(st * 18)
            a = vis * clamp01(st * 5)
            g = T(self.faces, "semibold", "高考结束", 44, c0[0], c0[1] + 205, 0.12)
            tl = line_tile(g)
            dtile(C, tl, a * 0.92, REDD, scale=sc, rot=8.0)
            w, h = 250 * sc, 76 * sc
            ang = math.radians(-8.0)
            cx, cy = c0[0], c0[1] + 190
            corners = [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)]
            pts = [(cx + x * math.cos(ang) - y * math.sin(ang), cy + x * math.sin(ang) + y * math.cos(ang))
                   for x, y in corners]
            C.ink.polyline("red", pts, 255 * a, 2.0, closed=True)

    def formula(self, C, t, vis):
        fc = self.faces
        top = T(fc, "regular", "a² + b² = c²", 66, 960, 330)
        gtext(C, top, "silver", vis * ease_out((t - self.s("s2_15") - 0.2) / 0.9), gain=0.95)
        lab1 = T(fc, "light", "前 人 的 公 式", 24, 960, 228, 0.2)
        gtext(C, lab1, "silver", vis * 0.8, gain=0.8)
        arrow_p = ease((t - self.at("s2_15", 0.40)) / 0.7)
        if arrow_p > 0:
            C.ink.partial("dim", *K.with_cum([(960, 372), (960, 448)]), arrow_p, 255 * vis, 1.0)
        der = T(fc, "regular", "3² + 4² = 9 + 16 = 25 = 5²", 56, 960, 548)
        dp = ease((t - self.at("s2_15", 0.45)) / 2.6)
        if dp > 0:
            K.trace_glyphs(C.ink, "gold", der, dp, 255 * vis, 1.0, "hot", 255 * vis)
            gtext(C, der, "hot", vis * ease((t - self.at("s2_15", 0.45) - 1.8) / 1.0), gain=0.75)
        lab2 = T(fc, "light", "自 己 的 推 理", 24, 960, 640, 0.2)
        gtext(C, lab2, "gold", vis * ease((t - self.at("s2_15", 0.55)) / 0.8), gain=1.0)


class S3(Scene):
    def __init__(self, *a):
        super().__init__(*a)
        fc = self.faces
        self.belief = T(fc, "semibold", "只要足够努力，就一定能够考好。", 56, 960, 492, 0.06)
        self.belief2 = T(fc, "semibold", "既然努力不保证成功，那努力就没有意义。", 52, 960, 492, 0.05)
        bt = line_tile(self.belief)
        a, ox, oy = bt
        h, w = a.shape
        rng = np.random.default_rng(3)
        xs = np.linspace(-6, w + 6, 26)
        ys = h * 0.52 + np.cumsum(rng.normal(0, 4.5, len(xs)))
        ys = np.clip(ys - (ys.mean() - h * 0.5), h * 0.2, h * 0.8)
        self.crack = np.stack([xs + ox, ys + oy], axis=1)
        yy, xx = np.mgrid[0:h, 0:w]
        cy = np.interp(xx, xs, ys)
        top = (yy < cy).astype(np.float32)
        self.halves = ((a * top, ox, oy), (a * (1 - top), ox, oy))
        self.crack_pc = K.with_cum(self.crack)

    def params(self, t, P):
        off = rp(t, self.s("s3_01") - 0.2, 1.4)
        back = rp(t, self.s("s3_13") - 0.6, 1.4)
        P["eye_on"] = max(1.0 - off + back, 0.0)
        P["ring"] = P["eye_on"]
        P["tint"] = (0.92, 0.98, 1.08)
        conflict = rp(t, self.s("s3_05") + 0.3, 1.8) * (1 - rp(t, self.at("s3_06", 0.3), 2.4))
        P["shear"] = 0.85 * conflict
        P["turb"] = 1.0 + 0.8 * conflict - 0.45 * back
        P["sgain"] = 1.0 + 0.25 * conflict - 0.3 * rp(t, self.s("s3_11"), 0.8) * (1 - rp(t, self.s("s3_13") - 0.3, 1))
        spark = math.exp(-((t - self.at("s3_06", 0.25)) / 1.8) ** 2)
        P["hgain"] = 1.0 + 1.8 * spark
        P["ggain"] = 1.0 + 1.0 * spark
        P["U"] = 1.0 - 0.25 * back
        self.lower(t, P)

    def draw(self, C, t, f):
        fc = self.faces
        # --- the belief, and its crack -----------------------------------------------
        bv = ease_out((t - self.s("s3_02") - 0.1) / 1.0) * (1 - rp(t, self.at("s3_05", 0.3), 1.2))
        if bv > 0:
            tc = self.at("s3_03", 0.62)
            k = ease_out((t - tc - 0.2) / 0.9)
            dim = 1 - 0.55 * rp(t, self.s("s3_04"), 1.0)
            frame_p = ease((t - self.s("s3_02")) / 1.1)
            for yy in (418.0, 534.0):
                C.ink.line("dim", (960 - 470 * frame_p, yy), (960 + 470 * frame_p, yy), 255 * bv)
            if t < tc + 0.2:
                dtext(C, self.belief, PAPER, bv, blur=5 * (1 - bv), glow=0.08)
            else:
                (a1, ox, oy), (a2, _, _) = self.halves
                dtile(C, (a1, ox, oy), bv * dim, PAPER * (0.85 + 0.15 * dim), -5 * k, -7 * k, rot=-0.7 * k)
                dtile(C, (a2, ox, oy), bv * dim, PAPER * (0.85 + 0.15 * dim), 6 * k, 8 * k, rot=0.6 * k)
            cp = ease((t - tc) / 0.35)
            if cp > 0:
                flash = math.exp(-((t - tc - 0.35) / 0.45) ** 2)
                C.ink.partial("hot", *self.crack_pc, cp, 255 * bv * (0.35 + 0.65 * flash), 1.6)
        # --- the spark: a beginning ------------------------------------------------------
        ts = self.at("s3_06", 0.15)
        sp = t - ts
        if 0 < sp < 4.5:
            rng = np.random.default_rng(9)
            a = math.exp(-sp * 0.9)
            for i in range(28):
                ang = i / 28 * math.tau + rng.uniform(-0.08, 0.08)
                r0 = 30 + rng.uniform(0, 30)
                r1 = r0 + (90 + rng.uniform(0, 260)) * ease_out(sp / 1.2)
                C.ink.line("gold", (960 + r0 * math.cos(ang), 540 + r0 * math.sin(ang) * 0.6),
                           (960 + r1 * math.cos(ang), 540 + r1 * math.sin(ang) * 0.6), 255 * a, 1.0)
            C.ink.circle("hot", (960, 540), 6 + 10 * math.exp(-sp * 3), 255 * a, fill=True)
        # --- the new conclusion, struck out -------------------------------------------------
        b2 = ease_out((t - self.s("s3_08") - 0.1) / 1.0) * (1 - rp(t, self.s("s3_10"), 1.0))
        if b2 > 0:
            dim = 1 - 0.45 * rp(t, self.at("s3_09", 0.55), 0.8)
            dtext(C, self.belief2, MIST * 0.95, b2 * dim, blur=5 * (1 - b2))
            sk = ease((t - self.at("s3_09", 0.5)) / 0.5)
            if sk > 0:
                tl = line_tile(self.belief2)
                y = tl[2] + tl[0].shape[0] * 0.52
                C.ink.partial("red", *K.with_cum([(tl[1] - 10, y + 4), (tl[1] + tl[0].shape[1] + 10, y - 4)]), sk,
                              255 * b2, 2.2)
        # --- examine both: old and new, side by side ------------------------------------
        ev = rp(t, self.s("s3_10") + 0.2, 0.9) * (1 - rp(t, self.s("s3_11") + 0.3, 0.8))
        if ev > 0:
            (a1, ox, oy), (a2, _, _) = self.halves
            sc = 0.55
            cyb = oy + a1.shape[0] / 2.0
            dy = 400.0 - cyb
            dtile(C, (a1, ox, oy), ev * 0.75, PAPER * 0.85, -410 - 3, dy - 4, scale=sc, rot=-0.7)
            dtile(C, (a2, ox, oy), ev * 0.75, PAPER * 0.85, -410 + 3, dy + 4, scale=sc, rot=0.6)
            tl2 = line_tile(self.belief2)
            dtile(C, tl2, ev * 0.75, MIST, 410, 400.0 - (tl2[2] + tl2[0].shape[0] / 2.0), scale=sc)
            for x, lab, k in ((550.0, "过去的观点", 0.25), (1370.0, "新的判断", 0.55)):
                pr = ease((t - self.at("s3_10", k)) / 1.0)
                C.ink.arc("gold", (x, 400), 300, 78, -90, -90 + 360 * pr, 255 * ev, 1.1)
                g = T(fc, "light", lab, 24, x, 528, 0.2)
                gtext(C, g, "gold", ev * pr, gain=0.9)
        # --- doubt about doubt about doubt: an infinite regress ------------------------------
        rv = rp(t, self.s("s3_11") + 0.2, 0.8) * (1 - rp(t, self.s("s3_12") + 0.1, 0.7))
        if rv > 0:
            self.regress(C, t, rv)
        # --- the exam paper is collected ---------------------------------------------------------
        xv = rp(t, self.s("s3_12") + 0.1, 0.5) * (1 - rp(t, self.s("s3_13") + 0.4, 0.8))
        if xv > 0:
            self.paper(C, t, xv)

    LABELS = ["怀疑 · 观点", "怀疑 · 理由", "怀疑 · 理由的理由", "怀疑 · 怀疑理由的理由"]

    def regress(self, C, t, vis):
        fc = self.faces
        r = 0.62
        z = (t - self.s("s3_11")) * 0.62                      # frames per second of zoom
        base = 1460.0
        for k in range(-1, 9):
            kk = k - (z % 1.0)
            idx = int(math.floor(z)) + k
            w = base * (r ** kk)
            if w < 30 or w > 2600:
                continue
            h = w * 0.5
            ang = math.radians(4.0 * (idx % 7 - 3) + 2.0 * kk)
            cx, cy = 960.0, 420.0
            cs, sn = math.cos(ang), math.sin(ang)
            pts = [(cx + x * cs - y * sn, cy + x * sn + y * cs) for x, y in
                   [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)]]
            fade = clamp01((1560 - w) / 420) * clamp01((w - 30) / 60)
            C.ink.polyline("silver", pts, 255 * vis * fade, 1.0 + 0.6 * clamp01(w / 1400), closed=True)
            lab = self.LABELS[idx % len(self.LABELS)]
            g = T(fc, "regular", lab, 40, 0, 0, 0.08, "left", 0.0)
            tl = line_tile(g)
            s = w / 1460.0 * 0.95
            fade *= clamp01((0.92 - s) / 0.25)
            lx = pts[0][0] + 26 * s
            ly = pts[0][1] + 20 * s
            gtile(C, tl, vis * fade, "paper", dx=lx - tl[1] - tl[0].shape[1] * (1 - s) / 2,
                  dy=ly - tl[2] - tl[0].shape[0] * (1 - s) / 2, scale=s, rot=-math.degrees(ang), gain=0.7)
        q = T(fc, "light", "？", 90, 968, 450)
        gtext(C, q, "gold", vis * (0.6 + 0.4 * math.sin(t * 3)), gain=0.9)

    def paper(self, C, t, vis):
        fc = self.faces
        t0 = self.s("s3_12")
        d = self.d("s3_12")
        slide_in = ease_out((t - t0) / 0.8)
        collect = ease_in((t - t0 - d * 0.62) / 0.9)
        dy = (1 - slide_in) * 700 - collect * 950
        cx, cy = 960.0, 470.0 + dy
        ang = math.radians(-3.0)
        w, h = 620.0, 400.0
        cs, sn = math.cos(ang), math.sin(ang)

        def tr(x, y):
            return (cx + x * cs - y * sn, cy + x * sn + y * cs)
        C.ink.polyline("paper", [tr(-w / 2, -h / 2), tr(w / 2, -h / 2), tr(w / 2, h / 2), tr(-w / 2, h / 2)],
                       255 * vis * 0.8, 1.2, closed=True)
        for i in range(5):
            y = -10 + i * 42
            C.ink.line("dim", tr(-w / 2 + 50, y), tr(w / 2 - 50, y), 255 * vis * 0.8)
        hdr = T(fc, "regular", "期 中 考 试 · 语 文", 30, 0, 0, 0.1)
        htl = line_tile(hdr)
        hx, hy = tr(0, -140)
        gtile(C, htl, vis, "paper", dx=hx - htl[1] - htl[0].shape[1] / 2, dy=hy - htl[2] - htl[0].shape[0] / 2,
              rot=3.0, gain=0.75)
        nm = T(fc, "regular", "姓名：", 32, 0, 0, 0.04, "left", 0.0)
        ntl = line_tile(nm)
        nx, ny = tr(-w / 2 + 60, -78)
        gtile(C, ntl, vis, "paper", dx=nx - ntl[1], dy=ny - ntl[2] - 26, rot=3.0, gain=0.75)
        C.ink.line("silver", tr(-w / 2 + 160, -60), tr(-w / 2 + 380, -60), 255 * vis)
        # a scribbled name, then a doubt
        wp = ease((t - t0 - d * 0.18) / 1.0)
        if wp > 0:
            xs = np.linspace(0, 190, 60)
            sig = np.stack([xs, -12 * np.sin(xs / 9.0) * np.exp(-xs / 160) - 4 * np.sin(xs / 3.1)], 1)
            pts = np.array([tr(-w / 2 + 175 + p[0], -72 + p[1]) for p in sig])
            C.ink.partial("gold", *K.with_cum(pts), wp, 255 * vis, 1.5)
        qa = t - (t0 + d * 0.38)
        if qa > 0:
            q = T(fc, "semibold", "？", 120, 0, 0)
            sc = 1.0 + 0.35 * math.exp(-qa * 8) * math.cos(qa * 20)
            qtl = line_tile(q)
            # the question mark stays behind when the paper is collected
            qx, qy = tr(-w / 2 + 500, -52)
            qy = qy + collect * 950 * 0.92
            gtile(C, qtl, clamp01(qa * 4) * (1 - rp(t, self.e("s3_12") - 0.3, 0.8)) * (vis if collect < 0.05 else 1),
                  "gold", dx=qx - qtl[1] - qtl[0].shape[1] / 2, dy=qy - qtl[2] - qtl[0].shape[0] / 2, scale=sc,
                  gain=0.95)


class S4(Scene):
    O = np.array([760.0, 600.0])
    U = 70.0

    def __init__(self, *a):
        super().__init__(*a)
        rng = np.random.default_rng(44)
        self.frags = []
        for i, s in enumerate(["2x + 1", "x²", "√x", "= ?", "≈ 3", "x = …", "f(−1)", "1/x", "−3", "x = −2"]):
            self.frags.append((s, rng.uniform(330, 1560), rng.uniform(220, 740), rng.uniform(0, 1)))
        hz = 430.0
        self.horizon = hz
        self.student = np.array([960.0, 770.0])
        self.paths = []
        for i, x in enumerate([260, 430, 600, 770, 1150, 1320, 1490, 1660]):
            p0 = self.student
            p3 = np.array([x, hz])
            pts = K.bezier(p0, p0 + [0, -150], p3 + [(960 - x) * 0.25, 120], p3, 60)
            self.paths.append(K.with_cum(pts) + (i,))
        self.main_path = K.with_cum(K.bezier(self.student, self.student + [0, -120], [960, hz + 120], [960, hz], 60))
        # boundaries around the self: solid ones are real, dashed ones are assumptions
        c = np.array([960.0, 470.0])
        self.bounds = []
        for i in range(6):
            a0 = math.tau * i / 6 + 0.3
            a1 = math.tau * (i + 1) / 6 + 0.3
            r = 260
            p0 = c + r * np.array([math.cos(a0), math.sin(a0) * 0.72])
            p1 = c + r * np.array([math.cos(a1), math.sin(a1) * 0.72])
            self.bounds.append((p0, p1, i % 2 == 0))

    def X(self, x):
        return self.O[0] + x * self.U

    def Y(self, y):
        return self.O[1] - y * self.U

    def params(self, t, P):
        off = rp(t, self.s("s4_02") - 0.2, 1.3)
        back = rp(t, self.s("s4_27") - 0.7, 1.3)
        mid = rp(t, self.s("s4_14") - 0.3, 1.0) * (1 - rp(t, self.s("s4_15") - 0.2, 1.0))
        P["eye_on"] = clamp01(1.0 - off + back + mid)
        P["ring"] = P["eye_on"]
        grid = rp(t, self.s("s4_02") + 0.2, 1.4) * (1 - rp(t, self.s("s4_14"), 1.2))
        P["grid"] = grid
        P["tint"] = (0.88, 1.0, 1.12)
        P["sgain"] = 1.0 - 0.45 * clamp01(off - back - mid)
        P["bgtint"] = (0.9, 1.0, 1.15)
        self.lower(t, P)

    def draw(self, C, t, f):
        av = rp(t, self.s("s4_02") + 0.2, 0.6) * (1 - rp(t, self.s("s4_14"), 1.2))
        if av > 0:
            self.axes(C, t, av)
        rv = rp(t, self.s("s4_15") + 0.1, 0.6) * (1 - rp(t, self.s("s4_24"), 1.2))
        if rv > 0:
            self.roads(C, t, rv)
        bv = rp(t, self.s("s4_25") + 0.3, 0.6) * (1 - rp(t, self.s("s4_27") - 0.2, 1.0))
        if bv > 0:
            self.boundaries(C, t, bv)

    def axes(self, C, t, vis):
        fc = self.faces
        t2 = self.s("s4_02")
        xa = ease((t - t2 - 0.4) / 1.0)
        ya = ease((t - t2 - 0.9) / 1.0)
        C.ink.partial("paper", *K.with_cum([(300, self.O[1]), (1650, self.O[1])]), xa, 230 * vis, 1.2)
        C.ink.partial("paper", *K.with_cum([(self.O[0], 790), (self.O[0], 170)]), ya, 230 * vis, 1.2)
        if xa >= 1:
            C.ink.polyline("paper", [(1640, self.O[1] - 6), (1652, self.O[1]), (1640, self.O[1] + 6)], 230 * vis, 1.2)
        if ya >= 1:
            C.ink.polyline("paper", [(self.O[0] - 6, 180), (self.O[0], 168), (self.O[0] + 6, 180)], 230 * vis, 1.2)
        for i in range(-6, 13):
            if i == 0:
                continue
            k = clamp01((t - t2 - 1.2 - (i + 6) * 0.03) / 0.3)
            x = self.X(i)
            C.ink.line("silver", (x, self.O[1] - 5), (x, self.O[1] + 5), 255 * vis * k)
        for j in (-2, -1, 1, 2, 3, 4, 5, 6):
            k = clamp01((t - t2 - 1.5) / 0.4)
            C.ink.line("silver", (self.O[0] - 5, self.Y(j)), (self.O[0] + 5, self.Y(j)), 255 * vis * k)
        lk = clamp01((t - t2 - 1.6) / 0.6)
        for txt, x, y in (("x", 1668, self.O[1] + 10), ("y", self.O[0] + 18, 168), ("O", self.O[0] - 20, self.O[1] + 30)):
            g = T(fc, "regular", txt, 30, x, y)
            gtext(C, g, "paper", vis * lk, gain=0.75)
        # f(x) on its domain
        t3 = self.s("s4_03")
        cp = ease((t - t3 - 0.3) / 1.8)
        xs = np.linspace(0.02, 12.0, 160)
        pts = np.stack([self.X(xs), self.Y(1.35 * np.sqrt(xs))], 1)
        C.ink.partial("gold", *K.with_cum(pts), cp, 255 * vis, 1.6)
        if cp > 0:
            C.ink.circle("gold", self.O, 5.0, 255 * vis * clamp01(cp * 4), 1.2)
            g = T(fc, "regular", "f(x)", 34, 1610, 230)
            gtext(C, g, "hot", vis * clamp01((cp - 0.8) * 5), gain=0.8)
        # domain: x > 0 … then all of ℝ … then x > 0 again
        t4, t5, t10 = self.s("s4_04"), self.s("s4_05"), self.s("s4_10")
        sh = rp(t, t4 + 0.3, 0.9)
        expand = rp(t, self.at("s4_05", 0.55), 1.4)
        snap_t = t - self.at("s4_10", 0.55)
        snap = 1 - math.exp(-snap_t * 6) * math.cos(snap_t * 9) if snap_t > 0 else 0.0   # springy
        e = expand * (1 - snap)
        left = min(lerp(self.O[0], 300.0, e), self.O[0] + 40)
        e = max(e, 0.0)
        if sh > 0:
            glow = 1.0 + 0.8 * math.exp(-((t - self.at("s4_06", 0.5)) / 1.0) ** 2)
            xx = C.gfx
            x0 = int(max(left, 0))
            ramp = np.clip((np.arange(x0, 1650) - left) / 40.0, 0, 1).astype(np.float32)
            vy = np.exp(-((np.arange(170, 790) - 480.0) / 330.0) ** 4).astype(np.float32)
            col = LIN["gold"] * 0.0065 * vis * sh * glow
            for c in range(3):
                xx[c][170:790, x0:1650] += vy[:, None] * ramp[None, :] * float(col[c])
            # textbook hatching of the domain
            hv = 70 * vis * sh * glow
            for k in range(-30, 60):
                xa = 300 + k * 34.0
                p0 = np.array([xa, 790.0])
                p1 = np.array([xa + 620.0, 170.0])
                if p1[0] < left or p0[0] > 1650:
                    continue
                # clip the 45° segment to [left, 1650]
                ta = max(0.0, (left - p0[0]) / 620.0)
                tb = min(1.0, (1650 - p0[0]) / 620.0)
                if tb > ta:
                    C.ink.line("dim", p0 + (p1 - p0) * ta, p0 + (p1 - p0) * tb, hv, 1.0)
            bvis = vis * sh * (1 - 0.8 * e)
            C.ink.dashed("gold", (self.O[0], 175), (self.O[0], 790), 9, 7, 255 * bvis, 1.6, phase=t * 20)
            lab = T(fc, "semibold", "x > 0", 40, 1240, 250)
            labR = T(fc, "semibold", "x ∈ R", 40, 1240, 250)
            gtext(C, lab, "hot", vis * sh * (1 - e), gain=0.8)
            gtext(C, labR, "silver", vis * sh * e, gain=0.9)
            dl = T(fc, "light", "定 义 域", 24, 1240, 196, 0.2)
            gtext(C, dl, "gold", vis * sh, gain=0.8)
        # carefree scribbles
        sv = rp(t, self.s("s4_07"), 0.4) * (1 - rp(t, self.s("s4_08") + 0.4, 0.8))
        if sv > 0:
            for (s, x, y, d) in self.frags[:-1]:
                g = T(fc, "regular", s, 30, x, y)
                tp = ease((t - self.s("s4_07") - d * 2.2) / 0.6)
                K.trace_glyphs(C.ink, "dim", g, tp, 255 * sv, 1.0)
        # x = −2
        t11 = self.s("s4_11")
        pv = rp(t, self.at("s4_11", 0.18), 0.4) * (1 - rp(t, self.e("s4_12") - 0.2, 0.6))
        if pv > 0:
            bump = t - self.at("s4_11", 0.45)
            dx = 0.0
            if bump > 0:
                dx = 110 * math.sin(min(bump, 0.6) / 0.6 * math.pi) * math.exp(-bump * 0.3) * (bump < 0.6)
            p = np.array([self.X(-2) + dx, self.O[1]])
            hit = math.exp(-((bump - 0.3) / 0.15) ** 2) if bump > 0 else 0
            C.ink.circle("red", p, 7.0, 255 * pv, fill=True)
            C.ink.circle("red", p, 12 + 3 * math.sin(t * 6), 120 * pv, 1.0)
            C.ink.dashed("red", (p[0], self.O[1] - 140), (p[0], self.O[1]), 6, 6, 160 * pv, 1.0)
            if hit > 0:
                C.ink.line("hot", (self.O[0], 300), (self.O[0], 760), 255 * hit * vis, 2.5)
            g = T(fc, "semibold", "x = −2", 34, self.X(-2), self.O[1] - 160)
            gtext(C, g, "red", pv, gain=0.95)
            xk = ease((t - self.at("s4_12", 0.2)) / 0.5)
            if xk > 0:
                for (a, b) in (((-16, -16), (16, 16)), ((16, -16), (-16, 16))):
                    C.ink.partial("red", *K.with_cum([p + a, p + b]), xk, 255 * pv, 2.6)
        # the boundary is there whether or not you know it
        bt = self.s("s4_13")
        bgl = rp(t, bt, 0.6) * (1 - rp(t, self.s("s4_14"), 1.0))
        if bgl > 0:
            C.ink.line("hot", (self.O[0], 175), (self.O[0], 790), 255 * bgl * vis, 1.0 + 2.5 * bgl)
            C.ink.line("gold", (self.O[0], 175), (self.O[0], 790), 255 * bgl * vis, 6.0)

    def roads(self, C, t, vis):
        fc = self.faces
        hz = self.horizon
        # perspective floor
        for i in range(-9, 10):
            C.ink.line("dim", (960 + i * 22, hz), (960 + i * 260, 1000), 120 * vis)
        for j in range(1, 7):
            y = hz + (1000 - hz) * (j / 7) ** 1.8
            C.ink.line("dim", (0, y), (W, y), 70 * vis)
        C.ink.line("silver", (0, hz), (W, hz), 140 * vis)
        mp = ease((t - self.s("s4_15") - 0.5) / 1.4)
        jit = 0.0
        flick = 0.0
        for k in ("s4_18", "s4_21"):
            w = rp(t, self.s(k), 0.4) * (1 - rp(t, self.e(k) - 0.3, 0.5))
            jit = max(jit, w)
        st = self.student + [jit * 14 * noise1(t * 2.5, 2), 0]
        main_gold = 1 - rp(t, self.at("s4_23", 0.55), 1.0)
        C.ink.partial("gold", self.main_path[0], self.main_path[1], mp, 255 * vis * main_gold, 1.8)
        C.ink.partial("silver", self.main_path[0], self.main_path[1], mp, 255 * vis * (1 - main_gold), 1.6)
        C.ink.circle("hot", st, 7.0, 255 * vis, fill=True)
        C.ink.circle("gold", st, 14 + 2 * math.sin(t * 2), 120 * vis, 1.0)
        # the other roads
        t17 = self.s("s4_17")
        ghost = rp(t, self.s("s4_20") + 0.3, 0.8) * (1 - rp(t, self.s("s4_21") + 0.2, 0.8))
        equal = rp(t, self.at("s4_23", 0.55), 1.2)
        for pts, cum, i in self.paths:
            pr = ease((t - t17 - 0.4 - i * 0.16) / 1.3)
            if pr <= 0:
                continue
            fl = 1.0
            if jit > 0:
                fl = 1 - jit * 0.6 * (0.5 + 0.5 * math.sin(t * 9 + i * 1.7))
            v = vis * fl * (1 - 0.8 * ghost)
            C.ink.partial("silver", pts, cum, pr, 255 * v * (1 - equal * 0.5), 1.3)
            if equal > 0:
                C.ink.partial("gold", pts, cum, pr, 200 * v * equal, 1.3)
        lab = T(fc, "regular", "唯一？", 32, 960, hz - 30)
        la = rp(t, self.at("s4_23", 0.2), 0.6) * (1 - rp(t, self.e("s4_23") - 0.3, 0.6))
        gtext(C, lab, "paper", vis * la, gain=0.8)

    def boundaries(self, C, t, vis):
        t25, t26 = self.s("s4_25"), self.s("s4_26")
        dis = rp(t, t26 + 0.3, 1.8)
        solid_glow = rp(t, t26 + 0.8, 1.0)
        for i, (p0, p1, solid) in enumerate(self.bounds):
            pr = ease((t - t25 - 0.6 - i * 0.25) / 0.9)
            if solid:
                pts, cum = K.with_cum([p0, p1])
                C.ink.partial("paper", pts, cum, pr, 255 * vis, 1.6)
                if solid_glow > 0:
                    C.ink.partial("gold", pts, cum, pr, 255 * vis * solid_glow, 2.0)
            else:
                if dis <= 0:
                    C.ink.dashed("silver", p0, p1, 10, 9, 255 * vis, 1.2, prog=pr)
                else:
                    # the assumption breaks apart and drifts away
                    d = p1 - p0
                    L = float(np.hypot(*d))
                    u = d / L
                    nrm = np.array([u[1], -u[0]])
                    c = (p0 + p1) / 2 - np.array([960, 470])
                    if np.dot(nrm, c) < 0:
                        nrm = -nrm
                    s = 0.0
                    j = 0
                    while s < L:
                        a, b = s, min(s + 10, L)
                        off = nrm * (dis * (40 + 30 * math.sin(j * 1.7 + i))) + u * dis * 8 * math.sin(j)
                        C.ink.line("silver", p0 + u * a + off, p0 + u * b + off, 255 * vis * (1 - dis), 1.2)
                        s += 19
                        j += 1
        C.ink.circle("hot", (960, 470), 5.0, 255 * vis, fill=True)


class S5(Scene):
    def __init__(self, *a):
        super().__init__(*a)
        fc = self.faces
        self.q1 = T(fc, "semibold", "当我们说「我认为」的时候——", 60, 960, 500, 0.07, gold=[False] * 4 + [True] * 5 + [False] * 5)
        self.q2 = T(fc, "medium", "我们真的知道，自己为什么这样认为吗？", 50, 960, 610, 0.05,
                    gold=[False] * 9 + [True] * 3 + [False] * 6)
        self.thanks = T(fc, "semibold", "谢谢大家", 84, 960, 560, 0.14)
        self.ty = T(fc, "regular", "THANK  YOU", 17, 960, 446, 0.42)
        self.sub = T(fc, "light", "当我们说「我认为」的时候 · 关于独立思考与自由", 24, 960, 668, 0.12)
        # the thread that goes with the world, then turns back to look at it
        a = K.bezier((60, 900), (600, 860), (1100, 930), (1480, 850), 120)
        b = K.bezier((1480, 850), (1700, 805), (1690, 690), (1490, 676), 60)[1:]
        c = K.bezier((1490, 676), (1380, 668), (1270, 690), (1150, 712), 50)[1:]
        self.turn = K.with_cum(np.vstack([a, b, c]))

    def params(self, t, P):
        off = rp(t, self.s("s5_01") - 0.2, 1.3)
        back = rp(t, self.s("s5_05") - 0.6, 1.3)
        off2 = rp(t, self.s("s5_06") - 0.3, 1.0) * (1 - rp(t, self.s("s5_08") - 0.6, 1.2))
        P["eye_on"] = clamp01(1.0 - off + back - off2)
        P["ring"] = P["eye_on"]
        warm = rp(t, self.s("s5_05"), 6.0)
        P["tint"] = (lerp(1.0, 1.10, warm), lerp(1.0, 1.0, warm), lerp(1.0, 0.86, warm))
        P["bgtint"] = (lerp(1.0, 1.25, warm), 1.0, lerp(1.0, 0.85, warm))
        climax = rp(t, self.s("s5_10"), 1.5) * (1 - rp(t, self.s("s5_11"), 2.0))
        P["hgain"] = 1.0 + 1.8 * climax
        P["ggain"] = 1.0 + 1.0 * climax
        calm = rp(t, self.s("s5_11"), 2.0)
        P["U"] = 1.0 - 0.35 * calm
        P["turb"] = 1.0 - 0.3 * calm
        P["fade"] = rp(t, self.tl.total - 2.6, 2.5)          # whole frame, text included
        self.lower(t, P)

    def draw(self, C, t, f):
        fc = self.faces
        vis = rp(t, self.s("s5_01") + 0.3, 0.9) * (1 - rp(t, self.s("s5_05") - 0.2, 0.9))
        spread = rp(t, self.s("s5_04") - 0.1, 1.0)
        xs = [lerp(BUB_X[0], 640, spread), lerp(BUB_X[1], 1280, spread), BUB_X[2], BUB_X[3]]
        fillA = ease((t - self.s("s5_02") - 0.3) / 0.7)
        pulse = math.exp(-((t - self.at("s5_03", 0.5)) / 0.7) ** 2)
        bubbles(C, fc, t, vis, xs, fillA, 0.0, 1 - spread, ease((t - self.s("s5_01") - 0.4) / 1.0), glowA=0.6 * pulse)
        votes_draw(C, t, self.at("s5_02", 0.4), self.s("s5_04") - 0.2, vis, speed=2.0)
        lv = vis * rp(t, self.at("s5_04", 0.2), 0.6)
        if lv > 0:
            for x, txt, k in ((xs[0], "独立？", 0.3), (xs[1], "盲从？", 0.65)):
                a = lv * ease((t - self.at("s5_04", k)) / 0.6)
                g = T(fc, "regular", txt, 36, x, 470)
                gtext(C, g, "paper", a, gain=0.85)
                sk = ease((t - self.at("s5_04", 0.85)) / 0.4)
                if sk > 0:
                    C.ink.partial("silver", *K.with_cum([(x - 64, 458), (x + 64, 450)]), sk, 255 * a, 1.6)
        # change of mind: the path turns, it does not break
        cv = rp(t, self.s("s5_06") + 0.2, 0.6) * (1 - rp(t, self.s("s5_07"), 0.8))
        if cv > 0:
            pts = np.vstack([K.bezier((340, 560), (700, 560), (860, 560), (1000, 560), 40),
                             K.bezier((1000, 560), (1110, 560), (1200, 470), (1560, 330), 60)[1:]])
            pr = ease((t - self.s("s5_06") - 0.3) / 2.2)
            tip = C.ink.partial("gold", *K.with_cum(pts), pr, 255 * cv, 2.0)
            if tip is not None and pr < 1:
                C.ink.circle("hot", tip, 4, 255 * cv, fill=True)
            xa = cv * rp(t, self.s("s5_06") + 0.6, 0.5)
            p = np.array([1150.0, 560.0])
            for a, b in (((-12, -12), (12, 12)), ((12, -12), (-12, 12))):
                C.ink.line("red", p + a, p + b, 220 * xa, 2.0)
            C.ink.dashed("dim", (1000, 560), (1135, 560), 6, 6, 255 * xa, 1.0)
        # conviction that has been tested: a straight path through a checkpoint
        kv = rp(t, self.s("s5_07") + 0.2, 0.6) * (1 - rp(t, self.s("s5_08") - 0.4, 0.8))
        if kv > 0:
            pr = ease((t - self.s("s5_07") - 0.3) / 2.4)
            pts, cum = K.with_cum([(340, 520), (1580, 520)])
            tip = C.ink.partial("gold", pts, cum, pr, 255 * kv, 2.0)
            if tip is not None and pr < 1:
                C.ink.circle("hot", tip, 4, 255 * kv, fill=True)
            through = 1.0 if (tip is None or tip[0] > 960) else 0.0
            fl = math.exp(-((t - (self.s("s5_07") + 0.3 + 2.4 * 0.5)) / 0.35) ** 2)
            C.ink.circle("paper", (960, 520), 62, 255 * kv * (0.7 + 0.3 * through), 1.2 + 2 * fl)
            if fl > 0.02:
                C.ink.circle("hot", (960, 520), 62, 255 * kv * fl, 2.5)
            g = T(fc, "light", "检 验", 26, 960, 430, 0.2)
            gtext(C, g, "paper", kv, gain=0.8)
        # turning back to look: the climax thread
        uv = rp(t, self.s("s5_10") + 0.3, 0.6) * (1 - rp(t, self.s("s5_11") + 0.5, 1.5))
        if uv > 0:
            pr = ease((t - self.s("s5_10") - 0.4) / (self.d("s5_10") * 0.75))
            tip = C.ink.partial("gold", *self.turn, pr, 255 * uv, 2.0)
            if tip is not None and pr < 1:
                C.ink.circle("hot", tip, 5, 255 * uv, fill=True)
        # the final question
        q1 = ease_out((t - self.s("s5_12") - 0.1) / 1.0) * (1 - rp(t, self.s("s5_14") - 0.1, 0.9))
        if q1 > 0:
            tp = ease((t - self.s("s5_12")) / 1.4)
            tv = 1 - rp(t, self.s("s5_12") + 1.8, 1.0)
            K.trace_glyphs(C.ink, "paper", [g for g in self.q1 if not g.gold], tp, 255 * tv * q1, 1.0, "hot", 200 * tv)
            K.trace_glyphs(C.ink, "gold", [g for g in self.q1 if g.gold], tp, 255 * tv * q1, 1.0, "hot", 255 * tv)
            fp = ease((t - self.s("s5_12") - 0.7) / 0.9)
            warm = ease((t - self.s("s5_12") - 1.4) / 1.0)
            for g in self.q1:
                col = PAPER * (1 - warm) + GOLD * warm if g.gold else PAPER
                dtext(C, [g], col, fp * q1, glow=0.3 * warm if g.gold else 0.08)
        q2 = (1 - rp(t, self.s("s5_14") - 0.1, 0.9))
        if q2 > 0 and t > self.s("s5_13"):
            stg = 0.05
            for g in self.q2:
                p = ease_out((t - self.s("s5_13") - 0.1 - g.idx * stg) / 0.8)
                col = GOLD if g.gold else PAPER
                dtext(C, [g], col, p * q2, dy=14 * (1 - p), blur=6 * (1 - p) ** 1.5, glow=0.25 if g.gold else 0.05)
        # thank you
        ts = self.s("s5_14")
        if t > ts:
            a = ease_out((t - ts - 0.6) / 1.4)
            tp = ease((t - ts - 0.2) / 1.6)
            tv = 1 - rp(t, ts + 2.2, 1.0)
            K.trace_glyphs(C.ink, "gold", self.thanks, tp, 255 * tv, 1.2, "hot", 255 * tv)
            dtext(C, self.thanks, PAPER, a, glow=0.12)
            b = ease((t - ts - 1.6) / 1.4)
            dtext(C, self.ty, MIST, 0.55 * b, dy=6 * (1 - b))
            dtext(C, self.sub, MIST, 0.8 * b, dy=8 * (1 - b))
            r = ease((t - ts - 1.8) / 1.2) * 40
            if r > 0:
                C.ink.line("gold", (960 - r, 610), (960 + r, 610), 230)


SCENES = {"S1": S1, "S2": S2, "S3": S3, "S4": S4, "S5": S5}


# ----------------------------------------------------------------------------
# Prologue title and section headings
# ----------------------------------------------------------------------------
class Prologue:
    def __init__(self, faces):
        fc = faces
        self.en = T(fc, "regular", "WHEN WE SAY “I THINK”", 16, 960, 444, 0.46)
        gm = [False] * 4 + [True] * 5 + [False] * 3
        self.main = T(fc, "semibold", "当我们说「我认为」的时候", 82, 960, 554, 0.07, gold=gm)
        self.sub = T(fc, "light", "关于独立思考与自由", 29, 960, 648, 0.38)

    def params(self, t, P):
        P["exposure"] = 0.03 + 0.97 * ease(t / 4.2)
        P["ring"] = ease_out((t - 2.4) / 3.4)

    def draw(self, C, t, f):
        out = 1 - rp(t, 12.6, 0.9)
        ob = 7 * (1 - out)
        for i, g in enumerate(self.en):
            p = ease((t - 3.8 - i * 0.03) / 1.8)
            dtext(C, [g], MIST, 0.58 * p * out, dy=6 * (1 - p), blur=4 * (1 - p) + ob)
        for i, g in enumerate(self.main):
            p = ease_out((t - 4.4 - i * 0.12) / 1.9)
            if g.gold:
                k = i - 4
                warm = ease((t - 7.6 - k * 0.12) / 1.5)
                pulse = math.exp(-((t - 8.6 - k * 0.12) / 0.85) ** 2)
                col = PAPER * (1 - warm) + GOLD * warm
                glow = 0.35 * warm + 0.7 * pulse
            else:
                col, glow = PAPER, 0.1 * p
            dtext(C, [g], col, p * out, dy=16 * (1 - p) - 8 * (1 - out), blur=9 * (1 - p) ** 1.5 + ob, glow=glow)
        rpn = R.ease_out_expo((t - 8.8) / 1.6) * out
        if rpn > 0:
            C.ink.line("gold", (960 - 46 * rpn, 598), (960 + 46 * rpn, 598), 230 * out)
        for i, g in enumerate(self.sub):
            p = ease((t - 9.2 - i * 0.07) / 1.7)
            dtext(C, [g], MIST, 0.82 * p * out, dy=8 * (1 - p), blur=5 * (1 - p) + ob)


def heading(C, faces, sec, t, total=5):
    """Section card: number traced in gold, title traced in light, then it
    shrinks into a quiet label in the top-left corner for the rest of the section."""
    lt = t - sec.t0
    num = T(faces, "semibold", sec.num, 120, 960, 500, 0.06)
    ttl = T(faces, "semibold", sec.title, 64, 960, 618, 0.08)
    cap = T(faces, "regular", f"PART  {sec.num}  /  0{total}", 15, 960, 380, 0.5)
    out = 1 - rp(lt, HEAD - 0.6, 0.7)
    if out > 0 and lt > 0.6:
        tp = ease((lt - 0.8) / 1.3)
        tv = (1 - rp(lt, 2.6, 0.9)) * out
        K.trace_glyphs(C.ink, "gold", num, tp, 255 * tv, 1.2, "hot", 255 * tv)
        fp = ease((lt - 1.4) / 0.9)
        dtext(C, num, GOLD, fp * out, blur=4 * (1 - out), glow=0.25 * fp)
        tp2 = ease((lt - 1.4) / 1.4)
        tv2 = (1 - rp(lt, 3.0, 0.9)) * out
        K.trace_glyphs(C.ink, "paper", ttl, tp2, 255 * tv2, 1.0, "hot", 200 * tv2)
        fp2 = ease((lt - 2.2) / 0.9)
        dtext(C, ttl, PAPER, fp2 * out, blur=4 * (1 - out), glow=0.08)
        cp = ease((lt - 1.0) / 1.2)
        dtext(C, cap, MIST, 0.55 * cp * out)
        r = ease((lt - 2.4) / 0.9) * 40 * out
        if r > 0.5:
            C.ink.line("gold", (960 - r, 664), (960 + r, 664), 230 * out)
    # the corner label for the rest of the section
    la = rp(lt, HEAD - 0.4, 0.8) * (1 - rp(t, sec.t_end - 0.2, 0.6))
    if la > 0:
        n = T(faces, "semibold", sec.num, 20, 0, 84, 0.05, "left", 92.0)
        s = T(faces, "regular", sec.title, 19, 0, 84, 0.12, "left", 136.0)
        dtext(C, n, GOLD, 0.85 * la)
        dtext(C, s, MIST, 0.55 * la)
        C.ink.line("dim", (92, 100), (92 + 34 * la, 100), 255 * la)


# ----------------------------------------------------------------------------
# Film
# ----------------------------------------------------------------------------
class Film:
    def __init__(self, fonts):
        p = lambda w: os.path.join(fonts, f"SourceHanSerifSC-{w}.otf")
        self.faces = {"semibold": K.Face(p("SemiBold")), "medium": K.Face(p("Medium")),
                      "regular": K.Face(p("Regular")), "light": K.Face(p("Light"))}
        self.tl = Timeline(self.faces)
        self.scenes = {s.key: SCENES[s.key](self.tl, s, self.faces) for s in self.tl.sections}
        self.pro = Prologue(self.faces)
        self.nframes = int(math.ceil(self.tl.total * FPS))
        band = np.exp(-((np.arange(H) - 880.0) / 120.0) ** 4).astype(np.float32)
        self.scrim_band = band[:, None]
        rng = np.random.default_rng(77)
        n = 260
        self.st_ang = rng.uniform(0, math.tau, n)
        self.st_cos, self.st_sin = np.cos(self.st_ang), np.sin(self.st_ang)
        self.st_off = rng.uniform(0, 1, n)
        self.st_spd = rng.uniform(0.6, 1.0, n)
        self.st_amp = rng.uniform(0.35, 1.0, n)
        self.st_gold = rng.uniform(0, 1, n) < 0.14

    def params(self, f):
        t = f / FPS
        P = dict(K.DEFAULT_P)
        P["scrim"] = 0.0
        sec = self.tl.section_at(t)
        if sec is None:
            self.pro.params(max(t, 0.0), P)
        else:
            self.scenes[sec.key].params(t, P)
        # warps: push through the eye into the flash, pull back out of it
        flashes = [s.t0 for s in self.tl.sections]
        for tf in flashes:
            if tf - WARP_OUT <= t < tf:
                k = (t - (tf - WARP_OUT)) / WARP_OUT
                P["zoom"] = math.exp(math.log(5.0) * k ** 2.3)
                P["mblur"] = 0.36 * k ** 1.5
                P["flash"] = 2.6 * smoothstep_s(0.88, 1.0, k) ** 2
                P["exposure"] *= 1.0 + 0.5 * k * k
                P["roll"] = -4.0 * k ** 2
                P["ca"] = 0.014 * k ** 1.5
                P["wk_out"] = k
            elif tf <= t < tf + WARP_IN:
                k = (t - tf) / WARP_IN
                P["zoom"] = lerp(1.7, 1.0, ease_out(k))
                P["mblur"] = 0.20 * (1 - k) ** 2.5
                P["flash"] = 2.6 * math.exp(-(t - tf) * 16.0)
                P["roll"] = 5.0 * (1 - ease_out(k)) ** 2
                P["ca"] = 0.010 * (1 - k) ** 2
                P["wk_in"] = k
        P["zoom_cx"], P["zoom_cy"] = ECX, ECY
        return P

    def tunnel(self, ink, P):
        """Hyperspace tunnel along the eye's geometry: radial light streaks and
        eye-shaped rings rushing past, drawn on top of the camera move."""
        ko, ki = P.get("wk_out", -1.0), P.get("wk_in", -1.0)
        if ko < 0 and ki < 0:
            return
        A, B = 760.0, 470.0                       # streak space (elliptical, like the eye)
        if ko >= 0:
            speed, travel, vis = 0.25 + 2.4 * ko ** 1.6, ko * (0.6 + 1.6 * ko), clamp01(ko * 2.2)
        else:
            e = 1.0 - (1.0 - ki) ** 2.2
            speed, travel, vis = 2.6 * (1 - ki) ** 2, 2.2 + 0.9 * e, (1 - ki) ** 1.4
        for i in range(len(self.st_ang)):
            u = (self.st_off[i] + travel * self.st_spd[i]) % 1.0
            r = 0.05 * math.exp(3.3 * u)           # 0.05 … 1.35 of the streak space
            ln = r * min(0.85, 0.04 + 0.30 * speed)
            ca, sa = self.st_cos[i], self.st_sin[i]
            p0 = (ECX + A * r * ca, ECY + B * r * sa)
            p1 = (ECX + A * (r + ln) * ca, ECY + B * (r + ln) * sa)
            a = vis * clamp01((r - 0.06) / 0.25) * self.st_amp[i]
            if a > 0.02:
                ink.line("gold" if self.st_gold[i] else "silver", p0, p1, 255 * a, 1.0 + 0.8 * clamp01(speed - 1))
        for j in range(6):
            u = (j / 6.0 + travel * 0.55) % 1.0
            sc = 0.06 * math.exp(3.6 * u)
            a = vis * clamp01((sc - 0.08) / 0.2) * clamp01((2.2 - sc) / 0.8)
            if a > 0.02:
                ink.arc("silver", (ECX, ECY), 705 * sc, 212 * sc, 0, 360, 200 * a, 1.0)
                if j % 2 == 0:
                    ink.arc("gold", (ECX, ECY), 705 * sc * 1.03, 212 * sc * 1.03, 30 * j, 30 * j + 80, 255 * a, 1.2)

    def ctx(self, f, P):
        t = f / FPS
        C = Ctx(f, t, P, self.faces)
        sec = self.tl.section_at(t)
        eye_rings(C, f, P["ring"])
        if sec is None:
            self.pro.draw(C, t, f)
        else:
            self.scenes[sec.key].draw(C, t, f)
            heading(C, self.faces, sec, t)
            b = self.tl.beat_at(t)
            if b is not None:
                caption(C, b, t, self.faces)
        return C

    def frame(self, comp, grain, bufs, f, P):
        C = self.ctx(f, P)
        ink = C.ink.resolve()
        post = None
        if P.get("wk_out", -1) >= 0 or P.get("wk_in", -1) >= 0:
            ip = K.Ink()
            self.tunnel(ip, P)
            post = ip.resolve()
        planes = comp.frame(bufs, f, P, ink, C._gfx, self.scrim_band if P["scrim"] > 0.01 else None, P["scrim"],
                            post)
        for op in C.disp:
            op(planes)
        fd = P.get("fade", 0.0)
        if fd > 0:
            planes = [p * (1.0 - fd) for p in planes]
        return R.finish(planes, grain.get(f))


def smoothstep_s(e0, e1, x):
    k = clamp01((x - e0) / (e1 - e0))
    return k * k * (3 - 2 * k)


# compositor hook for the caption scrim (darkens the lower band behind captions)
_frame0 = K.FilmCompositor.frame


def _frame_scrim(self, bufs, f, P, ink, gfx, band=None, scrim=0.0, post=None):
    out = _frame0(self, bufs, f, P, ink, gfx, post)
    if band is not None:
        m = (1.0 - 0.42 * scrim * band).astype(np.float32)
        out = [o * m for o in out]
    return out


K.FilmCompositor.frame = _frame_scrim


# ----------------------------------------------------------------------------
# Driver
# ----------------------------------------------------------------------------
WARM = 1000


def render_range(fonts, f0, f1, path, crf, threads=None):
    if threads:
        cv2.setNumThreads(threads)
        import numexpr
        numexpr.set_num_threads(threads)
    film = Film(fonts)
    sim = K.FilmSim()
    comp = K.FilmCompositor()
    grain = R.Grain()
    pipe = None
    if path:
        cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
               "-r", str(FPS), "-i", "-",
               "-vf", "scale=out_color_matrix=bt709:out_range=tv:flags=lanczos+accurate_rnd+full_chroma_int",
               "-c:v", "libx264", "-preset", "slow", "-crf", str(crf), "-tune", "film", "-threads", "3",
               "-profile:v", "high", "-level", "4.2", "-pix_fmt", "yuv420p", "-g", "60", "-bf", "2",
               "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
               path]
        pipe = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    t0 = time.time()
    for f in range(f0 - WARM, f1):
        P = film.params(max(f, 0))
        sim.step(f, P)
        if f >= f0 and pipe:
            pipe.stdin.write(film.frame(comp, grain, sim.snapshot(), f, P).tobytes())
        if f >= f0 and (f - f0) % 150 == 0:
            el = time.time() - t0
            print(f"[{os.path.basename(path or '')}] {f - f0}/{f1 - f0}  {el:.0f}s", flush=True)
    if pipe:
        pipe.stdin.close()
        pipe.wait()


def stills(fonts, times, out, warm=360):
    film = Film(fonts)
    sim = K.FilmSim()
    comp = K.FilmCompositor()
    grain = R.Grain()
    frames = sorted(int(round(t * FPS)) for t in times)
    os.makedirs(out, exist_ok=True)
    cur = None
    for fr in frames:
        start = fr - warm
        if cur is None or start > cur or cur > fr:
            sim = K.FilmSim()
            cur = start
        for f in range(cur, fr + 1):
            P = film.params(max(f, 0))
            sim.step(f, P)
        cur = fr + 1
        img = film.frame(comp, grain, sim.snapshot(), fr, P)
        cv2.imwrite(os.path.join(out, f"t{fr / FPS:07.2f}.png"), cv2.cvtColor(img, cv2.COLOR_RGB2BGR))
        print("still", fr / FPS, flush=True)


def cue_sheet(fonts, path):
    tl = Timeline({k: K.Face(os.path.join(fonts, f"SourceHanSerifSC-{v}.otf"))
                   for k, v in (("semibold", "SemiBold"), ("medium", "Medium"), ("regular", "Regular"),
                                ("light", "Light"))})
    def tc(t):
        return f"{int(t // 60):02d}:{t % 60:05.2f}"
    lines = ["# 演讲影片 · 时间轴（提词对照）", "",
             f"总长 {tc(tl.total)}。每一句话出现在画面上的时刻如下，可以照着它练习语速；",
             "也可以使用分段文件，讲到哪一部分就切到哪一段。", "",
             f"| 时间 | 内容 |", "| --- | --- |", f"| {tc(0)} | **序幕** · 当我们说「我认为」的时候 |"]
    for s in tl.sections:
        lines.append(f"| {tc(s.t0)} | **{s.num} · {s.title}**（转场 + 标题） |")
        for b in s.beats:
            lines.append(f"| {tc(b.start)} | {b.text} |")
    lines.append(f"| {tc(tl.total)} | 结束 |")
    open(path, "w").write("\n".join(lines) + "\n")
    return tl


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fonts", required=True)
    ap.add_argument("--out", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "film"))
    sub = ap.add_subparsers(dest="cmd", required=True)
    s1 = sub.add_parser("stills")
    s1.add_argument("--t", required=True)
    s1.add_argument("--warm", type=int, default=360)
    s2 = sub.add_parser("range")
    s2.add_argument("--f0", type=int, required=True)
    s2.add_argument("--f1", type=int, required=True)
    s2.add_argument("--path", required=True)
    s2.add_argument("--crf", type=int, default=19)
    s2.add_argument("--threads", type=int, default=1)
    s3 = sub.add_parser("render")
    s3.add_argument("--jobs", type=int, default=4)
    s3.add_argument("--crf", type=int, default=19)
    s3.add_argument("--chunk", type=float, default=50.0)
    sub.add_parser("cues")
    sub.add_parser("info")
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)

    if args.cmd == "stills":
        stills(args.fonts, [float(x) for x in args.t.split(",")], args.out, args.warm)
    elif args.cmd == "range":
        render_range(args.fonts, args.f0, args.f1, args.path, args.crf, args.threads)
    elif args.cmd == "cues" or args.cmd == "info":
        tl = cue_sheet(args.fonts, os.path.join(args.out, "时间轴.md"))
        print("total", tl.total, "s")
        for s in tl.sections:
            print(s.key, f"{s.t0:.1f}", f"{s.t_end:.1f}", len(s.beats))
    elif args.cmd == "render":
        render_all(args)


def render_all(args):
    """Chunks are cut at section flashes (so each section is a clean file) and
    further split to balance the workers. Each chunk warms its own simulation
    for WARM frames, which reproduces the continuous state exactly."""
    tl = cue_sheet(args.fonts, os.path.join(args.out, "时间轴.md"))
    total = int(math.ceil(tl.total * FPS))
    cuts = [0] + [int(round(s.t0 * FPS)) for s in tl.sections] + [total]
    segs = []                       # (name, f0, f1)
    names = ["00_序幕"] + [f"{s.num}_{s.title.replace('，', '').replace('？', '')}" for s in tl.sections]
    for i in range(len(cuts) - 1):
        segs.append((names[i], cuts[i], cuts[i + 1]))
    chunks = []
    step = int(args.chunk * FPS)
    for name, a, b in segs:
        n = max(1, round((b - a) / step))
        edges = [a + (b - a) * k // n for k in range(n + 1)]
        for k in range(n):
            chunks.append((name, k, edges[k], edges[k + 1]))
    tmp = os.path.join(args.out, "_chunks")
    os.makedirs(tmp, exist_ok=True)
    chunks.sort(key=lambda c: -(c[3] - c[2]))
    procs = []
    queue_ = list(chunks)
    t0 = time.time()
    me = os.path.abspath(__file__)
    while queue_ or procs:
        while queue_ and len(procs) < args.jobs:
            name, k, a, b = queue_.pop(0)
            p = os.path.join(tmp, f"{name}_{k:02d}.mp4")
            if os.path.exists(p + ".ok"):
                continue
            cmd = [sys.executable, me, "--fonts", args.fonts, "--out", args.out, "range", "--f0", str(a), "--f1",
                   str(b), "--path", p, "--crf", str(args.crf)]
            procs.append((subprocess.Popen(cmd), p))
        time.sleep(2)
        for pr, p in list(procs):
            if pr.poll() is not None:
                procs.remove((pr, p))
                if pr.returncode != 0:
                    raise SystemExit(f"chunk failed: {p}")
                open(p + ".ok", "w").close()
                print(f"chunk done {os.path.basename(p)}  {time.time() - t0:.0f}s", flush=True)
    # stitch: per-section files and the full film
    order = sorted(chunks, key=lambda c: c[2])
    for name, a, b in segs:
        parts = [os.path.join(tmp, f"{n}_{k:02d}.mp4") for (n, k, _, _) in order if n == name]
        concat(parts, os.path.join(args.out, f"分段_{name}.mp4"))
    concat([os.path.join(tmp, f"{n}_{k:02d}.mp4") for (n, k, _, _) in order],
           os.path.join(args.out, "当我们说我认为的时候_全片.mp4"))
    print("all done", time.time() - t0)


def concat(parts, out):
    lst = out + ".txt"
    with open(lst, "w") as fh:
        for p in parts:
            fh.write(f"file '{os.path.abspath(p)}'\n")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy",
                    "-movflags", "+faststart", out], check=True)
    os.remove(lst)


if __name__ == "__main__":
    main()
