#!/usr/bin/env python3
"""
「当我们说"我认为"的时候」 — 演讲背景视频渲染器
=================================================

Concept — 千流与一线 (a thousand currents, one thread)
  * A silver stream of tens of thousands of light-threads (the majority, "B")
    flows through an incompressible field. Velocity is the curl of a stream
    function, so density stays even: no clumping, silky lines.
  * At the centre sits a still elliptical "eye" — the stream bends around it.
    That eye is 「我」: the place where the title lives.
  * Gold threads are carried by the same current *and* by a field of their own,
    so they drift across the silver streamlines: they accept influence without
    obeying it (the thesis of the speech).
  * Hairline geometry (orbit rings, ticks, crop marks, rulers) quotes the
    定义域 / boundary motif from the maths classroom.

Everything is deterministic and exactly periodic:
  * every field mode completes an integer number of cycles per loop,
  * every particle lifetime divides the loop length,
  * respawn positions come from per-particle periodic tables,
  * the simulation is warmed up for one full loop before recording,
so the loop closes with no seam, and the intro's last frame flows straight
into loop frame 0.

Usage
  python3 render.py --fonts DIR preview --frames 0,600 --intro 3,8,14
  python3 render.py --fonts DIR render
"""
import argparse
import math
import os
import queue
import subprocess
import threading
import time

import cv2
import numexpr as ne
import numpy as np
from PIL import Image, ImageDraw, ImageFont

# ----------------------------------------------------------------------------
# Global format
# ----------------------------------------------------------------------------
W, H, FPS = 1920, 1080, 30
LOOP = 60 * FPS            # 1800 frames: seamless loop length
INTRO = 15 * FPS           # 450 frames: title sequence (ends at loop frame 0)
SEED = 20261104

CX, CY = 960.0, 532.0      # centre of the still "eye"
EA, EB = 705.0, 212.0      # eye semi-axes (px)
U0 = 2.1                   # free-stream speed, px / frame

TAU = 2.0 * math.pi
GRAIN_AMP = float(os.environ.get("GRAIN_AMP", "0.007"))


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def ease_out_cubic(t):
    t = min(max(t, 0.0), 1.0)
    return 1.0 - (1.0 - t) ** 3


def ease_out_expo(t):
    t = min(max(t, 0.0), 1.0)
    return 1.0 if t >= 1.0 else 1.0 - 2.0 ** (-10.0 * t)


def ease_in_out(t):
    t = min(max(t, 0.0), 1.0)
    return t * t * t * (t * (6.0 * t - 15.0) + 10.0)


def eye_rho2(x, y, sa=1.0):
    X = (x - CX) / (EA * sa)
    Y = (y - CY) / (EB * sa)
    return X * X + Y * Y


# ----------------------------------------------------------------------------
# Flow fields
# ----------------------------------------------------------------------------
class ModeField:
    """Sum of periodic travelling sine modes of a stream function, sampled on a
    grid each frame. Velocity = curl(mask * psi): divergence free, and no flux
    into the eye (mask == 0 there)."""

    def __init__(self, rng, n, lam_min, lam_max, vel_rms, cycles, step=4, pad=128,
                 mask_in=1.0, mask_out=1.9, slope=0.25, ang=None):
        self.step, self.pad = step, pad
        self.nx = (W + 2 * pad) // step + 1
        self.ny = (H + 2 * pad) // step + 1
        self.xs = (-pad + np.arange(self.nx) * step).astype(np.float64)
        self.ys = (-pad + np.arange(self.ny) * step).astype(np.float64)
        lam = np.exp(rng.uniform(math.log(lam_min), math.log(lam_max), n))
        if ang is None:
            a = rng.uniform(0, TAU, n)
        else:
            a = ang[0] + rng.uniform(-ang[1], ang[1], n) + rng.choice([0, math.pi], n)
        k = TAU / lam
        self.kx, self.ky = k * np.cos(a), k * np.sin(a)
        self.ph = rng.uniform(0, TAU, n)
        self.cyc = rng.choice(cycles, n) * rng.choice([-1, 1], n)
        self.amp = (lam / lam_max) ** slope / k
        X, Y = np.meshgrid(self.xs, self.ys)
        self.mask = smoothstep(mask_in, mask_out, np.sqrt(eye_rho2(X, Y)))
        u, v = self._uv(0)
        sel = self.mask > 0.99
        rms = math.sqrt(float(np.mean(u[sel] ** 2 + v[sel] ** 2)))
        self.amp *= vel_rms / rms
        self.uv = None

    def psi(self, f):
        ph_t = self.ph + TAU * self.cyc * (f % LOOP) / LOOP
        out = np.zeros((self.ny, self.nx))
        for i in range(len(self.amp)):
            a = self.kx[i] * self.xs
            b = self.ky[i] * self.ys + ph_t[i]
            out += self.amp[i] * (np.outer(np.cos(b), np.sin(a)) + np.outer(np.sin(b), np.cos(a)))
        return out * self.mask

    def _uv(self, f):
        dpy, dpx = np.gradient(self.psi(f), self.step)
        return dpy, -dpx

    def update(self, f):
        u, v = self._uv(f)
        self.uv = np.stack([u.ravel(), v.ravel()], axis=1).astype(np.float32)

    def sample(self, p):
        fx = (p[:, 0] + self.pad) / self.step
        fy = (p[:, 1] + self.pad) / self.step
        np.clip(fx, 0, self.nx - 1.001, out=fx)
        np.clip(fy, 0, self.ny - 1.001, out=fy)
        ix = fx.astype(np.int32)
        iy = fy.astype(np.int32)
        tx = (fx - ix)[:, None]
        ty = (fy - iy)[:, None]
        i0 = iy * self.nx + ix
        uv = self.uv
        a = uv[i0] * (1 - tx) + uv[i0 + 1] * tx
        b = uv[i0 + self.nx] * (1 - tx) + uv[i0 + self.nx + 1] * tx
        return a * (1 - ty) + b * ty


def eye_flow(p, U):
    """Analytic potential flow of a uniform stream around the elliptical eye."""
    X = (p[:, 0] - CX) / EA
    Y = (p[:, 1] - CY) / EB
    r2 = np.maximum(X * X + Y * Y, 1.0)
    r4 = r2 * r2
    u = U * ((1.0 - 1.0 / r2) + 2.0 * Y * Y / r4)
    v = -2.0 * U * (EB / EA) * X * Y / r4
    return np.stack([u, v], axis=1)


# ----------------------------------------------------------------------------
# Particle layers
# ----------------------------------------------------------------------------
class Layer:
    def __init__(self, rng, n, lifetimes, speed, weight, jitter, substeps, box, buf,
                 own=0.0, carry=1.0, fade=(0.16, 0.72), keepout=1.03, gain="breath"):
        self.n = n
        self.speed, self.substeps = speed, substeps
        self.own, self.carry = own, carry
        self.fade, self.buf, self.gain = fade, buf, gain
        self.L = rng.choice(lifetimes, n).astype(np.int64)
        self.off = rng.integers(0, LOOP, n)
        cmax = int((LOOP // self.L).max())
        x0, y0, x1, y1 = box
        sp = np.empty((n, cmax, 2))
        sp[..., 0] = rng.uniform(x0, x1, (n, cmax))
        sp[..., 1] = rng.uniform(y0, y1, (n, cmax))
        for _ in range(80):                     # nothing is born inside the eye
            bad = eye_rho2(sp[..., 0], sp[..., 1], keepout) < 1.0
            if not bad.any():
                break
            sp[..., 0][bad] = rng.uniform(x0, x1, bad.sum())
            sp[..., 1][bad] = rng.uniform(y0, y1, bad.sum())
        self.spawn = sp.astype(np.float32)
        self.w = (weight * rng.lognormal(0.0, jitter, n)).astype(np.float32)
        self.pos = None
        self.idx = np.arange(n)
        self.check()

    def check(self):
        assert np.all(LOOP % self.L == 0), "lifetimes must divide the loop"
        self.C = LOOP // self.L

    def respawn(self, f, force=False):
        t = f + self.off
        age = np.mod(t, self.L)
        cyc = np.mod(np.floor_divide(t, self.L), self.C)
        sel = self.idx if force else self.idx[age == 0]
        if self.pos is None:
            self.pos = np.zeros((self.n, 2), np.float32)
        self.pos[sel] = self.spawn[sel, cyc[sel]]
        return age

    def envelope(self, frac):
        a, b = self.fade
        return (smoothstep(0.0, a, frac) * (1.0 - smoothstep(b, 1.0, frac))).astype(np.float32)


def bilinear_splat(buf_flat, p, w):
    x = p[:, 0]
    y = p[:, 1]
    ok = (x >= 0) & (x < W - 1) & (y >= 0) & (y < H - 1) & (w > 1e-6)
    x, y, w = x[ok], y[ok], w[ok]
    ix = x.astype(np.int32)
    iy = y.astype(np.int32)
    fx = x - ix
    fy = y - iy
    i0 = iy * W + ix
    idx = np.concatenate([i0, i0 + 1, i0 + W, i0 + W + 1])
    wt = np.concatenate([w * (1 - fx) * (1 - fy), w * fx * (1 - fy), w * (1 - fx) * fy, w * fx * fy])
    buf_flat += np.bincount(idx, weights=wt, minlength=W * H).astype(np.float32)


class Sim:
    BUFS = ("Sm", "Sf", "N", "G", "R")

    def __init__(self):
        rng = np.random.default_rng(SEED)
        # main current: long meanders + mid-scale eddies (silver threads ride this)
        self.main = ModeField(rng, 22, 380, 1700, 0.50 * U0, cycles=(1, 1, 2, 2, 3))
        # the gold threads' own reasoning: a different, broader field
        self.gold = ModeField(rng, 12, 700, 2300, 0.80 * U0, cycles=(1, 2), slope=0.1,
                              mask_in=1.0, mask_out=1.45)
        box = (-190, -40, W + 30, H + 40)
        self.far = Layer(rng, 52000, [150, 180, 200, 225], 0.52, 0.060, 0.55, 2, box, "Sf")
        self.mid = Layer(rng, 15000, [90, 100, 120, 150], 1.0, 0.150, 0.50, 3, box, "Sm")
        self.near = Layer(rng, 260, [60, 72, 90], 1.75, 0.85, 0.40, 4, box, "N", fade=(0.25, 0.6))
        self.dust = Layer(rng, 340, [150, 180, 200, 225], 1.0, 0.17, 0.50, 4, box, "G",
                          own=0.85, carry=0.85, fade=(0.2, 0.7), gain="flat")
        hero_box = (-300, 230, -110, H - 230)   # born off-screen: the first turn is never seen
        self.hero = Layer(rng, 3, [600], 1.06, 1.0, 0.0, 12, hero_box, "R",
                          own=0.50, carry=0.92, fade=(0.12, 0.86), keepout=1.35, gain="flat")
        self.hero.L[:] = [600, 900, 900]
        self.hero.check()
        self.hero.off[:] = [120, 420, 870]
        self.hero.w[:] = [4.2, 3.4, 3.8]
        self.layers = [self.far, self.mid, self.near, self.dust, self.hero]

        self.buf = {k: np.zeros(W * H, np.float32) for k in self.BUFS}
        self.decay = {"Sm": 0.955, "Sf": 0.948, "N": 0.86, "G": 0.968, "R": 0.9935}
        self.started = False

    def step(self, f):
        fl = f % LOOP
        U = U0 * (1.0 + 0.10 * math.sin(TAU * fl / LOOP + 0.9))
        breath = 1.0 + 0.14 * math.sin(TAU * 2 * fl / LOOP + 0.4)
        self.main.update(f)
        self.gold.update(f)
        for k, b in self.buf.items():
            b *= self.decay[k]
        for ly in self.layers:
            age = ly.respawn(f, force=not self.started)
            gain = breath if ly.gain == "breath" else 1.0
            ss = ly.substeps
            dt = 1.0 / ss
            vref = U0 * ly.speed
            pts, wts = [], []

            def vel(p):
                v = eye_flow(p, U) + self.main.sample(p)
                if ly.own > 0:
                    v = ly.carry * v + ly.own * self.gold.sample(p)
                return v * ly.speed

            for s in range(ss):
                env = ly.envelope((age + (s + 0.5) * dt) / ly.L)
                k1 = vel(ly.pos)
                k2 = vel(ly.pos + (0.5 * dt) * k1)
                ly.pos = (ly.pos + dt * k2).astype(np.float32)
                # long-exposure normalisation: equal energy per unit length,
                # so slow particles near stagnation points don't pile into dots
                spd = np.sqrt(k2[:, 0] ** 2 + k2[:, 1] ** 2) / vref
                pts.append(ly.pos.copy())
                wts.append(ly.w * env * np.clip(spd, 0.06, 2.2).astype(np.float32) * (gain * dt))
            bilinear_splat(self.buf[ly.buf], np.concatenate(pts), np.concatenate(wts))
        self.started = True

    def snapshot(self):
        return {k: v.reshape(H, W).copy() for k, v in self.buf.items()}


# ----------------------------------------------------------------------------
# Typography
# ----------------------------------------------------------------------------
class Glyph:
    def __init__(self, alpha, x, y, ch, role):
        self.a = alpha
        self.x, self.y = x, y
        self.ch, self.role = ch, role


def render_line(text, font_path, size, tracking, cx, baseline_y, role_fn, ss=3, squeeze=True):
    """Lay out a line glyph by glyph at ss× and return per-glyph alpha tiles at 1x.
    Corner brackets get optical spacing (标点挤压) so 「我认为」 sits tight."""
    font = ImageFont.truetype(font_path, size * ss)
    adv, shift = [], []
    for ch in text:
        a = font.getlength(ch)
        s = 0.0
        if squeeze and ch in "「『（":
            s = -0.42 * size * ss
            a *= 0.58
        elif squeeze and ch in "」』），、。；：":
            a *= 0.58
        adv.append(a + tracking * size * ss)
        shift.append(s)
    total = sum(adv) - tracking * size * ss
    x = cx * ss - total / 2.0
    asc, desc = font.getmetrics()
    glyphs = []
    pad = int(size * ss * 0.35)
    for i, ch in enumerate(text):
        gx = x + shift[i]
        tw = int(font.getlength(ch)) + 2 * pad
        th = asc + desc + 2 * pad
        im = Image.new("L", (tw, th), 0)
        ImageDraw.Draw(im).text((pad, pad), ch, font=font, fill=255)
        top_ss = baseline_y * ss - asc - pad
        left_ss = gx - pad
        lx = int(math.floor(left_ss / ss)) * ss
        ty = int(math.floor(top_ss / ss)) * ss
        canvas = Image.new("L", (tw + 2 * ss, th + 2 * ss), 0)
        canvas.paste(im, (int(round(left_ss - lx)), int(round(top_ss - ty))))
        cw = (canvas.width // ss) * ss
        chh = (canvas.height // ss) * ss
        arr = np.asarray(canvas, np.float32)[:chh, :cw] / 255.0
        small = cv2.resize(arr, (cw // ss, chh // ss), interpolation=cv2.INTER_AREA)
        if small.max() > 1e-3:
            glyphs.append(Glyph(small, lx // ss, ty // ss, ch, role_fn(i, ch)))
        x += adv[i]
    return glyphs


class Title:
    PAPER = np.array([0.930, 0.905, 0.860], np.float32)    # display-space colours
    GOLD = np.array([0.950, 0.780, 0.470], np.float32)
    MIST = np.array([0.700, 0.745, 0.810], np.float32)

    def __init__(self, fonts):
        semibold = os.path.join(fonts, "SourceHanSerifSC-SemiBold.otf")
        light = os.path.join(fonts, "SourceHanSerifSC-Light.otf")
        regular = os.path.join(fonts, "SourceHanSerifSC-Regular.otf")
        main = "当我们说「我认为」的时候"
        self.main = render_line(main, semibold, 82, 0.07, CX, CY + 22,
                                lambda i, c: "gold" if 4 <= i <= 8 else "paper")
        self.en = render_line("WHEN WE SAY “I THINK”", regular, 16, 0.46, CX, CY - 88,
                              lambda i, c: "mist", squeeze=False)
        self.sub = render_line("关于独立思考与自由", light, 29, 0.38, CX, CY + 116,
                               lambda i, c: "mist", squeeze=False)
        self.rule_y = CY + 66

    @staticmethod
    def _blit(img, g, alpha_mul, dy, blur, color, glow):
        if alpha_mul <= 0.002:
            return
        a = g.a
        ox, oy = g.x, g.y
        if blur > 0.25:
            pad = int(blur * 3) + 2
            a = cv2.GaussianBlur(cv2.copyMakeBorder(a, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=0),
                                 (0, 0), blur)
            ox, oy = ox - pad, oy - pad
        if abs(dy) > 1e-3:                       # sub-pixel vertical drift
            iy = int(math.floor(dy))
            fy = dy - iy
            ih, iw = a.shape
            a = cv2.warpAffine(a, np.float32([[1, 0, 0], [0, 1, fy]]), (iw, ih + 1), flags=cv2.INTER_LINEAR)
            oy += iy
        a = a * alpha_mul
        ih, iw = a.shape
        if glow > 0:
            gp = 42
            ga = cv2.copyMakeBorder(a, gp, gp, gp, gp, cv2.BORDER_CONSTANT, value=0)
            ga = cv2.GaussianBlur(ga, (0, 0), 14) * 0.9 + cv2.GaussianBlur(ga, (0, 0), 4) * 0.45
            for c in range(3):
                _add(img[c], ga * float(color[c] * glow), ox - gp, oy - gp)
        y0, x0 = max(oy, 0), max(ox, 0)
        y1, x1 = min(oy + ih, H), min(ox + iw, W)
        if y1 <= y0 or x1 <= x0:
            return
        aa = a[y0 - oy:y1 - oy, x0 - ox:x1 - ox]
        for c in range(3):
            reg = img[c][y0:y1, x0:x1]
            reg *= (1.0 - aa)
            reg += aa * float(color[c])

    def composite(self, img, t, f_loop, settled=False):
        """t = seconds into the intro. settled=True renders the final, resting
        state used by the loop (which equals the intro's last frame)."""
        breath = 0.5 - 0.5 * math.cos(TAU * 3 * (f_loop % LOOP) / LOOP)    # 0 at loop frame 0
        glow_base = 0.30 + 0.10 * breath

        for i, g in enumerate(self.en):
            p = 1.0 if settled else ease_in_out((t - 4.4 - i * 0.03) / 1.9)
            self._blit(img, g, 0.58 * p, 6.0 * (1 - p), 4.0 * (1 - p), self.MIST, 0.0)

        for i, g in enumerate(self.main):
            if settled:
                p, warm, pulse = 1.0, 1.0, 0.0
            else:
                p = ease_out_cubic((t - 5.0 - i * 0.13) / 1.9)
                k = i - 4
                warm = ease_in_out((t - 8.5 - k * 0.12) / 1.5) if g.role == "gold" else 0.0
                pulse = math.exp(-((t - 9.5 - k * 0.12) / 0.85) ** 2) if g.role == "gold" else 0.0
            if g.role == "gold":
                col = self.PAPER * (1 - warm) + self.GOLD * warm
                glow = glow_base * warm + 0.70 * pulse
            else:
                col = self.PAPER
                glow = 0.10 * p
            self._blit(img, g, p, 16.0 * (1 - p), 9.0 * (1 - p) ** 1.5, col, glow)

        rp = 1.0 if settled else ease_out_expo((t - 9.7) / 1.6)
        if rp > 0.001:
            half = 46.0 * rp
            y = int(round(self.rule_y))
            x0, x1 = CX - half, CX + half
            xs = np.arange(int(math.floor(x0)), int(math.ceil(x1)) + 1)
            cov = np.clip(np.minimum(xs + 1 - x0, x1 - xs), 0, 1).astype(np.float32)
            fade = (1 - (np.abs(xs - CX) / 50.0) ** 2).clip(0, 1).astype(np.float32)
            a = cov * fade * 0.85
            for c in range(3):
                img[c][y, xs] = img[c][y, xs] * (1 - a) + a * float(self.GOLD[c])

        for i, g in enumerate(self.sub):
            p = 1.0 if settled else ease_in_out((t - 10.2 - i * 0.07) / 1.7)
            self._blit(img, g, 0.82 * p, 8.0 * (1 - p), 5.0 * (1 - p), self.MIST, 0.0)


CHAPTERS = [
    ("04_章节一_多数人的答案", "01", "多数人的答案",
     "B 的票数再多，也不代表 B 就是正确答案。"),
    ("05_章节二_我们的思想真的独立吗", "02", "我们的思想，真的独立吗？",
     "独立思考并不是拒绝外界，而是学会审视外界带给我们的东西。"),
    ("06_章节三_独立思考就是不断怀疑吗", "03", "独立思考，就是不断怀疑吗？",
     "怀疑不是目的，理解才是；否定不是终点，完善才是。"),
    ("07_章节四_定义域与自由", "04", "定义域与自由",
     "不知道边界，不代表边界不存在。"),
    ("08_章节五_回到最初的选择", "05", "回到最初的选择",
     "不把习惯当成真理，不把多数人的选择当成自己的答案。"),
]


class Card:
    """A resting (static) title card in the eye: index, heading, gold rule, key line.
    Shares the stream with every other output, so cross-fading between cards in
    PowerPoint reads as the words changing over one continuous current."""
    PAPER, GOLD, MIST = Title.PAPER, Title.GOLD, Title.MIST

    def __init__(self, fonts, index, heading, quote, total="05", head_size=64, caption=None):
        semibold = os.path.join(fonts, "SourceHanSerifSC-SemiBold.otf")
        light = os.path.join(fonts, "SourceHanSerifSC-Light.otf")
        cap = caption if caption is not None else f"{index}  /  {total}"
        n_idx = len(index) if caption is None else 0
        self.cap = render_line(cap, semibold, 17, 0.32, CX, CY - 78,
                               lambda i, c: "gold" if i < n_idx else "mist", squeeze=False)
        self.head = render_line(heading, semibold, head_size, 0.08, CX, CY + 16, lambda i, c: "paper")
        self.quote = render_line(quote, light, 24, 0.14, CX, CY + 102, lambda i, c: "mist")
        self.rule_y = CY + 54

    def composite(self, img, f):
        col = {"gold": self.GOLD, "paper": self.PAPER, "mist": self.MIST}
        for g in self.cap:
            Title._blit(img, g, 0.95 if g.role == "gold" else 0.55, 0, 0, col[g.role], 0.0)
        for g in self.head:
            Title._blit(img, g, 1.0, 0, 0, self.PAPER, 0.10)
        _rule(img, self.rule_y, 34.0)
        for g in self.quote:
            Title._blit(img, g, 0.84, 0, 0, self.MIST, 0.0)


def _rule(img, y, half, alpha=0.85):
    y = int(round(y))
    x0, x1 = CX - half, CX + half
    xs = np.arange(int(math.floor(x0)), int(math.ceil(x1)) + 1)
    cov = np.clip(np.minimum(xs + 1 - x0, x1 - xs), 0, 1).astype(np.float32)
    fade = (1 - (np.abs(xs - CX) / (half + 4.0)) ** 2).clip(0, 1).astype(np.float32)
    a = cov * fade * alpha
    for c in range(3):
        img[c][y, xs] = img[c][y, xs] * (1 - a) + a * float(Title.GOLD[c])


def make_cards(fonts):
    cards = [(name, Card(fonts, idx, head, quote)) for name, idx, head, quote in CHAPTERS]
    cards.append(("09_结尾_谢谢大家", Card(fonts, "", "谢谢大家", "我们真的知道，自己为什么这样认为吗？",
                                       head_size=70, caption="THANK  YOU")))
    return cards


def _add(img, tile, ox, oy):
    th, tw = tile.shape
    y0, x0 = max(oy, 0), max(ox, 0)
    y1, x1 = min(oy + th, H), min(ox + tw, W)
    if y1 > y0 and x1 > x0:
        img[y0:y1, x0:x1] += tile[y0 - oy:y1 - oy, x0 - ox:x1 - ox]


# ----------------------------------------------------------------------------
# Hairline geometry overlay (drawn at 2x with sub-pixel precision, area-downsampled)
# ----------------------------------------------------------------------------
GEO_SS = 2
SHIFT = 4
_M = GEO_SS * (1 << SHIFT)


def _pt(x, y):
    return (int(round(x * _M)), int(round(y * _M)))


class Geometry:
    BOX = (max(0, int(CX - EA * 1.06)), max(0, int(CY - EB * 1.16)),
           min(W, int(CX + EA * 1.06)), min(H, int(CY + EB * 1.16)))

    def __init__(self):
        self.static = self._static()

    @staticmethod
    def _static():
        """Crop marks and edge rulers: a quiet coordinate frame that never moves."""
        im = np.zeros((H * GEO_SS, W * GEO_SS), np.uint8)
        m, L, th = 44, 24, GEO_SS
        for (x, y, dx, dy) in [(m, m, 1, 1), (W - m, m, -1, 1), (m, H - m, 1, -1), (W - m, H - m, -1, -1)]:
            cv2.line(im, _pt(x, y), _pt(x + dx * L, y), 255, th, cv2.LINE_AA, SHIFT)
            cv2.line(im, _pt(x, y), _pt(x, y + dy * L), 255, th, cv2.LINE_AA, SHIFT)
        for i in range(41):
            x = m + 80 + i * (W - 2 * m - 160) / 40.0
            big = i % 5 == 0
            cv2.line(im, _pt(x, H - m), _pt(x, H - m - (8 if big else 4)), 190 if big else 110, th,
                     cv2.LINE_AA, SHIFT)
        for i in range(21):
            y = m + 80 + i * (H - 2 * m - 160) / 20.0
            big = i % 5 == 0
            cv2.line(im, _pt(m, y), _pt(m + (8 if big else 4), y), 190 if big else 110, th,
                     cv2.LINE_AA, SHIFT)
        return cv2.resize(im, (W, H), interpolation=cv2.INTER_AREA).astype(np.float32) / 255.0

    def dynamic(self, f, draw_on=1.0):
        """Orbit rings at the rim of the eye. Exactly periodic in the loop."""
        x0, y0, x1, y1 = self.BOX
        bw, bh = x1 - x0, y1 - y0
        im = np.zeros((bh * GEO_SS, bw * GEO_SS), np.uint8)
        if draw_on > 0:
            ph = (f % LOOP) / LOOP
            cx, cy = CX - x0, CY - y0
            th = GEO_SS
            # ring 1: a continuous 300° arc riding the rim; one revolution per loop
            start = 360.0 * ph + 205.0
            cv2.ellipse(im, _pt(cx, cy), _pt(EA * 1.0, EB * 1.0), 0, start, start + 300.0 * draw_on,
                        255, th, cv2.LINE_AA, SHIFT)
            # ring 2: 120 dashes inside the rim, counter-rotating by 5 dash periods per loop
            per = 360.0 / 120
            rot = -5 * per * ph
            for d in range(int(120 * draw_on)):
                a = d * per + rot
                cv2.ellipse(im, _pt(cx, cy), _pt(EA * 0.952, EB * 0.93), 0, a, a + per * 0.22, 150, th,
                            cv2.LINE_AA, SHIFT)
            # vertex ticks: the eye's "定义域" marks
            v = int(255 * draw_on)
            for sx in (-1, 1):
                xx = cx + sx * EA
                cv2.line(im, _pt(xx + sx * 10, cy), _pt(xx + sx * 34, cy), v, th, cv2.LINE_AA, SHIFT)
            for sy in (-1, 1):
                yy = cy + sy * EB
                cv2.line(im, _pt(cx, yy - sy * 6), _pt(cx, yy - sy * 16), v, th, cv2.LINE_AA, SHIFT)
        return cv2.resize(im, (bw, bh), interpolation=cv2.INTER_AREA).astype(np.float32) / 255.0


# ----------------------------------------------------------------------------
# Compositor (planar float32, fused with numexpr)
# ----------------------------------------------------------------------------
class Compositor:
    # linear-light colours
    SILVER = (0.50, 0.63, 0.84)
    SILVER_FAR = (0.42, 0.52, 0.72)
    SILVER_NEAR = (0.66, 0.75, 0.90)
    GOLD = (1.00, 0.64, 0.28)
    GOLD_HOT = (1.00, 0.84, 0.60)
    HAIR = (0.62, 0.68, 0.76)
    FOG = (0.0030, 0.0066, 0.0105)

    def __init__(self):
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        nx = (xx - CX) / (W * 0.5)
        ny = (yy - CY) / (H * 0.5)
        r = np.sqrt(nx * nx * 0.85 + ny * ny * 1.15)
        lift = np.exp(-r * r * 1.6)
        top = yy / H
        rho = np.sqrt(eye_rho2(xx, yy))
        inner = np.exp(-rho * rho * 1.4)
        self.bg = [
            (0.0015 + 0.0058 * lift + 0.0010 * top + 0.0040 * inner).astype(np.float32),
            (0.0023 + 0.0084 * lift + 0.0012 * top + 0.0031 * inner).astype(np.float32),
            (0.0044 + 0.0150 * lift + 0.0008 * top + 0.0022 * inner).astype(np.float32),
        ]
        self.vig = ((1.0 - 0.55 * smoothstep(0.55, 1.45, r)) *
                    (0.86 + 0.14 * smoothstep(0.80, 1.10, rho))).astype(np.float32)
        # visibility of the stream near the eye: a soft rim instead of a hard cut-out
        self.vis = (smoothstep(0.985, 1.50, rho) ** 1.2).astype(np.float32)
        rng = np.random.default_rng(SEED + 7)
        # moonlight: broad horizontal bands of light drifting through the current
        self.fogf = ModeField(rng, 9, 650, 2200, 1.0, cycles=(1, 1, 2), step=16, pad=0,
                              mask_in=-2, mask_out=-1, ang=(math.pi / 2, 0.55))
        self.geo = Geometry()
        self.geo_plane = np.zeros((H, W), np.float32)

    def fog_field(self, f):
        p = self.fogf.psi(f)
        p = (p - p.mean()) / (p.std() + 1e-6)
        fog = cv2.resize(p.astype(np.float32), (W, H), interpolation=cv2.INTER_CUBIC)
        return ne.evaluate("where(fog < -1.6, 0.02, where(fog > 1.6, 0.98, 0.5 + 0.3 * fog))")

    @staticmethod
    def bloom(src4):
        b1 = cv2.GaussianBlur(src4, (0, 0), 2.2)
        b2 = cv2.GaussianBlur(src4, (0, 0), 8.0)
        s16 = cv2.resize(src4, (W // 16, H // 16), interpolation=cv2.INTER_AREA)
        b3 = cv2.resize(cv2.GaussianBlur(s16, (0, 0), 5.0), (W // 4, H // 4), interpolation=cv2.INTER_LINEAR)
        acc = b1 * 0.55 + b2 * 0.42 + b3 * 0.38
        return cv2.resize(acc, (W, H), interpolation=cv2.INTER_LINEAR)

    def frame(self, bufs, f, exposure=1.0, geo_on=1.0):
        Sm, Sf, N, G, R = (bufs[k] for k in Sim.BUFS)
        fog = self.fog_field(f)
        vis = self.vis
        Sf = cv2.GaussianBlur(Sf, (0, 0), 0.75)
        Nb = cv2.GaussianBlur(N, (0, 0), 5.0)
        # light rivers: the fog decides where the moonlight falls on the current
        Im = ne.evaluate("(1 - exp(-Sm * 1.05)) * vis * (0.20 + 1.50 * fog * fog)")
        If = ne.evaluate("(1 - exp(-Sf * 1.0)) * vis * (0.30 + 1.0 * fog)")
        In = ne.evaluate("(1 - exp(-Nb * 1.7)) * vis * (0.35 + 0.9 * fog)")
        Ig = ne.evaluate("(1 - exp(-G * 1.0)) * vis")
        Ir = ne.evaluate("1 - exp(-R * 1.3)")
        Ic = ne.evaluate("where(R * 0.6 - 0.3 > 0, R * 0.6 - 0.3, 0)")
        Ic = ne.evaluate("where(Ic > 1, 1, Ic)")

        # bloom source at quarter resolution
        q = lambda a: cv2.resize(a, (W // 4, H // 4), interpolation=cv2.INTER_AREA)
        qm, qn, qg, qr = q(Im), q(In), q(Ig), q(Ir)
        src = np.stack([
            qm * (0.20 * self.SILVER[c]) + qn * (0.30 * self.SILVER_NEAR[c]) +
            qg * (0.95 * self.GOLD[c]) + qr * (1.35 * self.GOLD[c]) for c in range(3)], axis=-1)
        bl = self.bloom(src)

        geo = self.geo_plane
        geo[:] = self.geo.static * 0.075
        x0, y0, x1, y1 = self.geo.BOX
        geo[y0:y1, x0:x1] += self.geo.dynamic(f, geo_on) * 0.12
        vig = self.vig
        planes = []
        for c in range(3):
            bg = self.bg[c]
            b = bl[..., c]
            cs, cf, cn = self.SILVER[c] * 0.80, self.SILVER_FAR[c] * 0.44, self.SILVER_NEAR[c] * 0.34
            cg, cr, ch = self.GOLD[c] * 0.80, self.GOLD[c] * 0.95, self.GOLD_HOT[c]
            cfog, chair = self.FOG[c], self.HAIR[c]
            L = ne.evaluate(
                "(bg + fog * cfog + Im * cs + If * cf + In * cn + Ig * cg + Ir * cr + Ic * ch"
                " + b * 0.55 + geo * chair) * vig * exposure")
            planes.append(ne.evaluate("sqrt(L / (1 + 0.6 * L))"))
        # gentle split-tone: cool shadows, warm highlights
        r, g, b = planes
        tone = ne.evaluate("(r + g + b) / 3 * (1 - (r + g + b) / 3)")
        ne.evaluate("r + tone * 0.010", out=r)
        ne.evaluate("b - tone * 0.012", out=b)
        return planes


class Grain:
    """A bank of pre-rolled, slightly soft film-grain frames (fixed seed)."""
    N = 45                                   # divides LOOP, so the loop repeats exactly

    def __init__(self):
        rng = np.random.default_rng(1000003)
        self.bank = [cv2.GaussianBlur(rng.standard_normal((H, W), dtype=np.float32), (0, 0), 0.65)
                     .astype(np.float16) for _ in range(self.N)]

    def get(self, f):
        return self.bank[(f % LOOP) % self.N].astype(np.float32)


def finish(planes, grain):
    """Luminance-weighted grain (strongest in the mid-shadows), dither, quantise."""
    r, g, b = planes
    amp = ne.evaluate("GRAIN_AMP * (0.5 + 0.9 * sqrt(where(l > 0, l, 0))) * (1 - l) * grain",
                      local_dict={"l": ne.evaluate("(r + g + b) / 3"), "grain": grain,
                                  "GRAIN_AMP": np.float32(GRAIN_AMP)})
    out = [cv2.convertScaleAbs(ne.evaluate("p + amp"), alpha=255.0, beta=0.5) for p in planes]
    return cv2.merge(out)


# ----------------------------------------------------------------------------
# Encoding & timeline
# ----------------------------------------------------------------------------
def ffmpeg_writer(path, crf):
    cmd = ["ffmpeg", "-y", "-loglevel", "error",
           "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           "-vf", "scale=out_color_matrix=bt709:out_range=tv:flags=lanczos+accurate_rnd+full_chroma_int",
           "-c:v", "libx264", "-preset", "slow", "-crf", str(crf), "-tune", "film",
           "-profile:v", "high", "-level", "4.2", "-pix_fmt", "yuv420p",
           "-g", str(FPS * 2), "-bf", "2",
           "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-color_range", "tv",
           "-movflags", "+faststart", path]
    return subprocess.Popen(cmd, stdin=subprocess.PIPE)


def intro_exposure(t):
    return 0.03 + 0.97 * ease_in_out(t / 4.2)


def intro_geo(t):
    return ease_out_cubic((t - 2.6) / 3.4)


def compose(comp, title, grain, bufs, f, cards=None):
    """Return [intro] or [clean, title, *cards] frames as uint8 RGB."""
    gr = grain.get(f)
    if f < 0:
        t = (f + INTRO) / FPS
        planes = comp.frame(bufs, f, intro_exposure(t), intro_geo(t))
        title.composite(planes, t, f)
        return (finish(planes, gr),)
    planes = comp.frame(bufs, f)
    outs = [finish(planes, gr)]
    for card in cards or ():
        p = [x.copy() for x in planes]
        card.composite(p, f)
        outs.append(finish(p, gr))
    title.composite(planes, 0.0, f, settled=True)
    outs.insert(1, finish(planes, gr))
    return outs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fonts", required=True)
    ap.add_argument("--out", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "out"))
    ap.add_argument("--crf", type=int, default=19)
    sub = ap.add_subparsers(dest="cmd", required=True)
    pv = sub.add_parser("preview")
    pv.add_argument("--warm", type=int, default=420)
    pv.add_argument("--frames", default="0")
    pv.add_argument("--intro", default="")
    sub.add_parser("render")
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)

    sim = Sim()
    comp = Compositor()
    title = Title(args.fonts)
    grain = Grain()
    cards = make_cards(args.fonts)

    def save(name, rgb):
        cv2.imwrite(os.path.join(args.out, name), cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR))

    if args.cmd == "preview":
        wanted = sorted(int(x) for x in args.frames.split(",") if x)
        intro_f = {int(round(-INTRO + float(t) * FPS)): float(t) for t in args.intro.split(",") if t}
        last = max(wanted + list(intro_f) + [0])
        start = min([-args.warm] + [k - args.warm for k in intro_f])
        t0 = time.time()
        for f in range(start, last + 1):
            ts = time.time()
            sim.step(f)
            tsim = time.time() - ts
            if f in intro_f:
                save(f"intro_{intro_f[f]:05.2f}.png", compose(comp, title, grain, sim.snapshot(), f)[0])
            if f in wanted:
                tc = time.time()
                outs = compose(comp, title, grain, sim.snapshot(), f, [c for _, c in cards])
                tcomp = time.time() - tc
                save(f"loop_{f:04d}.png", outs[0])
                save(f"title_{f:04d}.png", outs[1])
                for (name, _), img in zip(cards, outs[2:]):
                    save(f"card_{name[:2]}_{f:04d}.png", img)
                print(f"frame {f}: sim {tsim * 1000:.0f} ms, composite {tcomp * 1000:.0f} ms", flush=True)
        print(f"total {time.time() - t0:.1f}s")
        return

    # full render: sim on the main thread, compositing + encoding on a worker
    names = ["03_循环_纯净无字", "02_循环_主标题"] + [n for n, _ in cards]
    intro_pipe = ffmpeg_writer(os.path.join(args.out, "01_片头_标题动画.mp4"), args.crf)
    loop_pipes = [ffmpeg_writer(os.path.join(args.out, n + ".mp4"), args.crf) for n in names]
    card_objs = [c for _, c in cards]
    q = queue.Queue(maxsize=3)

    def worker():
        while True:
            item = q.get()
            if item is None:
                return
            f, bufs = item
            out = compose(comp, title, grain, bufs, f, card_objs)
            if f < 0:
                intro_pipe.stdin.write(out[0].tobytes())
            else:
                for p, img in zip(loop_pipes, out):
                    p.stdin.write(img.tobytes())

    th = threading.Thread(target=worker, daemon=True)
    th.start()
    t0 = time.time()
    for f in range(-LOOP, LOOP):
        sim.step(f)
        if f >= -INTRO:
            q.put((f, sim.snapshot()))
        if f % 90 == 0:
            el = time.time() - t0
            done = f + LOOP + 1
            print(f"f={f:5d}  {done}/{2 * LOOP}  {el:6.0f}s  eta {el / done * (2 * LOOP - done):5.0f}s",
                  flush=True)
    q.put(None)
    th.join()
    for p in [intro_pipe] + loop_pipes:
        p.stdin.close()
        p.wait()
    print(f"done in {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
