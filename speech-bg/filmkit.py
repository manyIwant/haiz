"""
filmkit — building blocks for the full-length speech film.

  * Face / layout / glyph tiles / light-pen traces (fontTools outlines of 思源宋体)
  * Ink: 2× supersampled hairline vector layer (anti-aliased, area-downsampled)
  * FilmSim: the silver/gold flow-field stream with time-varying parameters
    (movable/scalable "eye" obstacle, shear layer, turbulence, point vortex)
  * FilmCompositor: linear-light compositing, bloom, camera zoom with radial
    motion blur, flash, vignette, tone curve
Shared look and simulation pieces come from render.py.
"""
import math

import cv2
import numexpr as ne
import numpy as np
from fontTools.pens.basePen import BasePen
from fontTools.ttLib import TTFont

import render as R

W, H, FPS = R.W, R.H, R.FPS
TAU = R.TAU
smoothstep = R.smoothstep


def clamp01(x):
    return min(max(x, 0.0), 1.0)


def ease(x):                    # smooth in-out (quintic)
    return R.ease_in_out(x)


def ease_out(x):
    return R.ease_out_cubic(x)


def ease_in(x):
    x = clamp01(x)
    return x * x * x


def rp(t, t0, d):
    """0→1 smooth ramp starting at t0 lasting d seconds."""
    return ease((t - t0) / d) if d > 0 else float(t >= t0)


def lerp(a, b, k):
    return a + (b - a) * k


# ============================================================================
# Text engine
# ============================================================================
class _FlatPen(BasePen):
    def __init__(self, gs, step):
        super().__init__(gs)
        self.contours, self.cur, self.step = [], None, step

    def _moveTo(self, p):
        self.cur = [tuple(p)]
        self.contours.append(self.cur)

    def _lineTo(self, p):
        self.cur.append(tuple(p))

    def _curveToOne(self, p1, p2, p3):
        p0 = self.cur[-1]
        L = math.dist(p0, p1) + math.dist(p1, p2) + math.dist(p2, p3)
        n = max(3, int(L / self.step))
        for i in range(1, n + 1):
            t = i / n
            a, b, c, d = (1 - t) ** 3, 3 * (1 - t) ** 2 * t, 3 * (1 - t) * t * t, t ** 3
            self.cur.append((a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
                             a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]))

    def _qCurveToOne(self, p1, p2):
        p0 = self.cur[-1]
        L = math.dist(p0, p1) + math.dist(p1, p2)
        n = max(3, int(L / self.step))
        for i in range(1, n + 1):
            t = i / n
            a, b, c = (1 - t) ** 2, 2 * (1 - t) * t, t * t
            self.cur.append((a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1]))

    def _closePath(self):
        if self.cur and self.cur[0] != self.cur[-1]:
            self.cur.append(self.cur[0])

    def _endPath(self):
        pass


class Face:
    def __init__(self, path):
        self.tt = TTFont(path, lazy=True)
        self.gs = self.tt.getGlyphSet()
        self.cmap = self.tt.getBestCmap()
        self.upm = self.tt["head"].unitsPerEm
        self.hmtx = self.tt["hmtx"]
        self.name = path
        self._g = {}

    def glyph(self, ch):
        g = self._g.get(ch)
        if g is None:
            gn = self.cmap.get(ord(ch))
            if gn is None:
                gn = self.cmap[ord("?")]
            pen = _FlatPen(self.gs, 6.0)
            self.gs[gn].draw(pen)
            cs = [np.array(c, np.float64) for c in pen.contours if len(c) > 1]
            adv = self.hmtx[gn][0]
            if cs:
                allp = np.concatenate(cs)
                ink = (allp[:, 0].min(), allp[:, 0].max())
            else:
                ink = (0.0, 0.0)
            g = (adv, cs, ink)
            self._g[ch] = g
        return g


LEFT_PUNCT = set("，。、；：？！）」』”’》")
RIGHT_PUNCT = set("（「『“‘《")


class G:
    """A positioned glyph."""
    __slots__ = ("ch", "x", "y", "size", "face", "gold", "contours", "cum", "tile", "tx", "ty", "line", "idx")


def layout(face, text, size, tracking=0.06, cx=W / 2, baseline=540.0, gold_mask=None, align="center", x0=None):
    """Lay out one line. Optical spacing for CJK punctuation (标点挤压) and
    optical centring (trailing punctuation does not push the line off centre)."""
    upm = face.upm
    s = size / upm
    items = []
    pen = 0.0
    n = len(text)
    for i, ch in enumerate(text):
        adv, cs, (ix0, ix1) = face.glyph(ch)
        shift = 0.0
        if ch in LEFT_PUNCT and cs:
            adv = ix1 + (0.32 * upm if i < n - 1 else 0.0)
        elif ch in RIGHT_PUNCT and cs:
            shift = -(ix0 - 0.10 * upm)
            adv = adv + shift
        items.append((ch, pen + shift * s, cs))
        pen += adv * s + (tracking * size if i < n - 1 else 0.0)
    width = pen
    if align == "center":
        left = cx - width / 2.0
    else:
        left = x0
    out = []
    for i, (ch, px, cs) in enumerate(items):
        g = G()
        g.ch, g.size, g.face = ch, size, face
        g.x, g.y = left + px, baseline
        g.gold = bool(gold_mask[i]) if gold_mask is not None else False
        g.contours = [np.stack([g.x + c[:, 0] * s, baseline - c[:, 1] * s], axis=1) for c in cs]
        g.cum = [np.concatenate([[0.0], np.cumsum(np.hypot(*np.diff(c, axis=0).T))]) for c in g.contours]
        g.tile = None
        g.idx = i
        out.append(g)
    return out, width


_tile_cache = {}


def glyph_tile(g):
    """Anti-aliased fill of the glyph's own outline (4× supersampled), so fill and
    trace are pixel-identical."""
    if g.tile is not None:
        return g.tile
    if not g.contours:
        g.tile = (None, 0, 0)
        return g.tile
    allp = np.concatenate(g.contours)
    x0 = int(math.floor(allp[:, 0].min())) - 2
    y0 = int(math.floor(allp[:, 1].min())) - 2
    x1 = int(math.ceil(allp[:, 0].max())) + 3
    y1 = int(math.ceil(allp[:, 1].max())) + 3
    key = (g.face.name, g.ch, round(g.size, 2), round((g.x - math.floor(g.x)) * 8), round((g.y - math.floor(g.y)) * 8))
    c = _tile_cache.get(key)
    if c is None:
        S = 4
        img = np.zeros(((y1 - y0) * S, (x1 - x0) * S), np.uint8)
        pts = [np.round((cc - [x0, y0]) * S * 4).astype(np.int32) for cc in g.contours]
        cv2.fillPoly(img, pts, 255, cv2.LINE_AA, 2)
        a = cv2.resize(img, (x1 - x0, y1 - y0), interpolation=cv2.INTER_AREA).astype(np.float32) / 255.0
        c = (a, x0 - int(math.floor(g.x)), y0 - int(math.floor(g.y)))
        _tile_cache[key] = c
        if len(_tile_cache) > 6000:
            _tile_cache.clear()
    a, dx, dy = c
    g.tile = (a, int(math.floor(g.x)) + dx, int(math.floor(g.y)) + dy)
    return g.tile


def text_block(face, lines, size, tracking, cx, cy, leading=1.62, gold=None):
    """Several centred lines around a vertical centre. lines: list of (text, goldmask)."""
    n = len(lines)
    lh = size * leading
    first = cy - (n - 1) * lh / 2.0 + size * 0.36
    glyphs = []
    k = 0
    for i, (txt, gm) in enumerate(lines):
        gl, _ = layout(face, txt, size, tracking, cx, first + i * lh, gm)
        for g in gl:
            g.line = i
            g.idx = k
            k += 1
        glyphs.extend(gl)
    return glyphs


def parse_markup(text):
    """'你选择了 {A}。' → ('你选择了 A。', mask)."""
    out, mask, on = [], [], False
    for ch in text:
        if ch == "{":
            on = True
        elif ch == "}":
            on = False
        else:
            out.append(ch)
            mask.append(on)
    return "".join(out), mask


def wrap(text, mask, maxc):
    """Break at Chinese punctuation into lines of <= maxc characters."""
    clauses, cur, cm = [], "", []
    for ch, m in zip(text, mask):
        cur += ch
        cm.append(m)
        if ch in "，。；：？！、—":
            clauses.append((cur, cm))
            cur, cm = "", []
    if cur:
        clauses.append((cur, cm))
    lines, lt, lm = [], "", []
    for ct, cmm in clauses:
        if len(lt) + len(ct) <= maxc or not lt:
            lt += ct
            lm += cmm
        else:
            lines.append((lt, lm))
            lt, lm = ct, list(cmm)
        while len(lt) > maxc + 2:                      # an over-long clause
            cut = maxc
            lines.append((lt[:cut], lm[:cut]))
            lt, lm = lt[cut:], lm[cut:]
    if lt:
        lines.append((lt, lm))
    # balance two-line splits that are very uneven
    return [(t.strip(" "), m[len(t) - len(t.lstrip(" ")):][:len(t.strip(" "))]) for t, m in lines]


# ============================================================================
# Display-space glyph compositing
# ============================================================================
def _add(plane, tile, ox, oy):
    th, tw = tile.shape
    y0, x0 = max(oy, 0), max(ox, 0)
    y1, x1 = min(oy + th, H), min(ox + tw, W)
    if y1 > y0 and x1 > x0:
        plane[y0:y1, x0:x1] += tile[y0 - oy:y1 - oy, x0 - ox:x1 - ox]


def blit(planes, a, ox, oy, alpha, color, dy=0.0, blur=0.0, glow=0.0, scale=1.0, mode="over"):
    """Composite an alpha tile with fade, sub-pixel vertical drift, defocus blur,
    glow and optional scale. mode 'over' (display space) or 'add' (emissive)."""
    if a is None or alpha <= 0.003:
        return
    if abs(scale - 1.0) > 1e-3:
        h0, w0 = a.shape
        nw, nh = max(1, int(round(w0 * scale))), max(1, int(round(h0 * scale)))
        cxp, cyp = ox + w0 / 2.0, oy + h0 / 2.0
        a = cv2.resize(a, (nw, nh), interpolation=cv2.INTER_AREA if scale < 1 else cv2.INTER_LINEAR)
        ox, oy = int(round(cxp - nw / 2.0)), int(round(cyp - nh / 2.0))
    if blur > 0.3:
        pad = int(blur * 3) + 2
        a = cv2.GaussianBlur(cv2.copyMakeBorder(a, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=0), (0, 0), blur)
        ox, oy = ox - pad, oy - pad
    if abs(dy) > 1e-3:
        iy = int(math.floor(dy))
        fy = dy - iy
        ih, iw = a.shape
        if fy > 1e-3:
            a = cv2.warpAffine(a, np.float32([[1, 0, 0], [0, 1, fy]]), (iw, ih + 1), flags=cv2.INTER_LINEAR)
        oy += iy
    a = a * alpha
    if glow > 0:
        gp = 36
        ga = cv2.copyMakeBorder(a, gp, gp, gp, gp, cv2.BORDER_CONSTANT, value=0)
        ga = cv2.GaussianBlur(ga, (0, 0), 12) * 0.9 + cv2.GaussianBlur(ga, (0, 0), 3.5) * 0.45
        for c in range(3):
            _add(planes[c], ga * float(color[c] * glow), ox - gp, oy - gp)
    ih, iw = a.shape
    y0, x0 = max(oy, 0), max(ox, 0)
    y1, x1 = min(oy + ih, H), min(ox + iw, W)
    if y1 <= y0 or x1 <= x0:
        return
    aa = a[y0 - oy:y1 - oy, x0 - ox:x1 - ox]
    for c in range(3):
        reg = planes[c][y0:y1, x0:x1]
        if mode == "over":
            reg *= (1.0 - aa)
        reg += aa * float(color[c])


# ============================================================================
# Ink — hairline vector layer (2× supersampled)
# ============================================================================
SS = 2
SH = 3
MUL = SS * (1 << SH)


def _ip(pts):
    return np.round(np.asarray(pts, np.float64) * MUL).astype(np.int32)


class Ink:
    """Named 8-bit canvases at 2×; resolved to float alpha planes at 1×."""

    def __init__(self):
        self.c = {}

    def cv(self, name):
        cv = self.c.get(name)
        if cv is None:
            cv = np.zeros((H * SS, W * SS), np.uint8)
            self.c[name] = cv
        return cv

    def polyline(self, name, pts, v=255, th=1.0, closed=False):
        if len(pts) < 2 or v <= 0:
            return
        cv2.polylines(self.cv(name), [_ip(pts)], closed, int(min(v, 255)), max(1, int(round(th * SS))),
                      cv2.LINE_AA, SH)

    def line(self, name, p0, p1, v=255, th=1.0):
        self.polyline(name, [p0, p1], v, th)

    def partial(self, name, pts, cum, prog, v=255, th=1.0):
        """Draw the first `prog` fraction (by length) of a polyline; returns tip."""
        if prog <= 0 or len(pts) < 2:
            return None
        L = cum[-1]
        if prog >= 1:
            self.polyline(name, pts, v, th)
            return pts[-1]
        d = prog * L
        k = int(np.searchsorted(cum, d))
        k = min(max(k, 1), len(pts) - 1)
        f = (d - cum[k - 1]) / max(cum[k] - cum[k - 1], 1e-9)
        tip = pts[k - 1] + (pts[k] - pts[k - 1]) * f
        self.polyline(name, np.vstack([pts[:k], tip[None]]), v, th)
        return tip

    def circle(self, name, c, r, v=255, th=1.0, fill=False):
        if v <= 0:
            return
        cv2.circle(self.cv(name), tuple(_ip(c)), int(round(r * MUL)), int(min(v, 255)),
                   -1 if fill else max(1, int(round(th * SS))), cv2.LINE_AA, SH)

    def arc(self, name, c, ax, ay, a0, a1, v=255, th=1.0, rot=0.0):
        if v <= 0 or a1 <= a0:
            return
        cv2.ellipse(self.cv(name), tuple(_ip(c)), (int(round(ax * MUL)), int(round(ay * MUL))), rot, a0, a1,
                    int(min(v, 255)), max(1, int(round(th * SS))), cv2.LINE_AA, SH)

    def poly_fill(self, name, pts, v=255):
        cv2.fillPoly(self.cv(name), [_ip(pts)], int(min(v, 255)), cv2.LINE_AA, SH)

    def dashed(self, name, p0, p1, dash=10, gap=8, v=255, th=1.0, phase=0.0, prog=1.0):
        p0, p1 = np.asarray(p0, float), np.asarray(p1, float)
        L = float(np.hypot(*(p1 - p0)))
        if L < 1:
            return
        u = (p1 - p0) / L
        s = -((phase % (dash + gap)))
        end = L * prog
        while s < end:
            a, b = max(s, 0), min(s + dash, end)
            if b > a:
                self.line(name, p0 + u * a, p0 + u * b, v, th)
            s += dash + gap

    def resolve(self):
        out = {}
        for k, cv in self.c.items():
            out[k] = cv2.resize(cv, (W, H), interpolation=cv2.INTER_AREA).astype(np.float32) * (1.0 / 255.0)
        return out


def bezier(p0, p1, p2, p3, n=64):
    t = np.linspace(0, 1, n)[:, None]
    p0, p1, p2, p3 = (np.asarray(p, float) for p in (p0, p1, p2, p3))
    return (1 - t) ** 3 * p0 + 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t * t * p2 + t ** 3 * p3


def with_cum(pts):
    pts = np.asarray(pts, float)
    return pts, np.concatenate([[0.0], np.cumsum(np.hypot(*np.diff(pts, axis=0).T))])


def trace_glyphs(ink, name, glyphs, prog, v=255, th=1.0, head=None, head_v=255):
    """Light-pen trace of glyph outlines: every contour advances together."""
    for g in glyphs:
        for pts, cum in zip(g.contours, g.cum):
            tip = ink.partial(name, pts, cum, prog, v, th)
            if head and tip is not None and prog < 1:
                ink.circle(head, tip, 1.6, head_v, fill=True)


# ============================================================================
# Stream simulation with time-varying parameters
# ============================================================================
DEFAULT_P = dict(eye_on=1.0, eye_cx=960.0, eye_cy=532.0, eye_a=705.0, eye_b=212.0,
                 U=1.0, turb=1.0, shear=0.0, vort=0.0, vx=1320.0, vy=470.0,
                 sgain=1.0, ggain=1.0, hgain=1.0, ring=1.0, exposure=1.0,
                 tint=(1.0, 1.0, 1.0), bgtint=(1.0, 1.0, 1.0), grid=0.0,
                 zoom=1.0, zoom_cx=960.0, zoom_cy=532.0, mblur=0.0, flash=0.0, eye_dim=1.0, roll=0.0, ca=0.0)


def eye_geom(P):
    s = P["eye_on"]
    return P["eye_cx"], P["eye_cy"], max(P["eye_a"] * s, 1.0), max(P["eye_b"] * s, 1.0), s


def flow(p, P, U):
    """Uniform/shear stream + potential flow round the eye + point vortex."""
    cx, cy, a, b, s = eye_geom(P)
    x, y = p[:, 0], p[:, 1]
    k = P["shear"]
    if s > 0.02:
        X = (x - cx) / a
        Y = (y - cy) / b
        r2 = np.maximum(X * X + Y * Y, 1.0)
        r4 = r2 * r2
        Ue = U * (1.0 - k)
        u = Ue * ((1.0 - 1.0 / r2) + 2.0 * Y * Y / r4)
        v = -2.0 * Ue * (b / a) * X * Y / r4
    else:
        u = np.full_like(x, U * (1.0 - k))
        v = np.zeros_like(x)
    if k > 1e-3:
        u = u + U * k * 1.6 * np.tanh((y - 540.0) / 85.0)
    if abs(P["vort"]) > 1e-3:
        dx, dy = x - P["vx"], y - P["vy"]
        r2 = dx * dx + dy * dy + 70.0 ** 2
        g = P["vort"] * R.U0 * 260.0
        u = u - g * dy / r2
        v = v + g * dx / r2
    return np.stack([u, v], axis=1)


class FilmField(R.ModeField):
    def update_dyn(self, f, P, gain):
        cx, cy, a, b, s = eye_geom(P)
        if s > 0.02:
            X, Y = np.meshgrid((self.xs - cx) / a, (self.ys - cy) / b)
            mask = smoothstep(1.0, self._mo, np.sqrt(X * X + Y * Y))
        else:
            mask = 1.0
        psi = self.psi_raw(f) * mask
        dpy, dpx = np.gradient(psi, self.step)
        self.uv = (np.stack([dpy.ravel(), -dpx.ravel()], axis=1) * gain).astype(np.float32)

    def psi_raw(self, f):
        ph_t = self.ph + TAU * self.cyc * (f % R.LOOP) / R.LOOP
        out = np.zeros((self.ny, self.nx))
        for i in range(len(self.amp)):
            a = self.kx[i] * self.xs
            b = self.ky[i] * self.ys + ph_t[i]
            out += self.amp[i] * (np.outer(np.cos(b), np.sin(a)) + np.outer(np.sin(b), np.cos(a)))
        return out


class FLayer:
    """Particle layer with periodic respawn tables (no fixed keep-out: particles
    born inside the current eye simply sit that life out)."""

    def __init__(self, rng, n, lifetimes, speed, weight, jitter, substeps, box, buf,
                 own=0.0, carry=1.0, fade=(0.16, 0.72), gain="breath"):
        self.n, self.speed, self.substeps = n, speed, substeps
        self.own, self.carry, self.fade, self.buf, self.gain = own, carry, fade, buf, gain
        self.L = rng.choice(lifetimes, n).astype(np.int64)
        assert np.all(R.LOOP % self.L == 0)
        self.C = R.LOOP // self.L
        self.off = rng.integers(0, R.LOOP, n)
        cmax = int(self.C.max())
        x0, y0, x1, y1 = box
        sp = np.empty((n, cmax, 2), np.float32)
        sp[..., 0] = rng.uniform(x0, x1, (n, cmax))
        sp[..., 1] = rng.uniform(y0, y1, (n, cmax))
        self.spawn = sp
        self.w = (weight * rng.lognormal(0.0, jitter, n)).astype(np.float32)
        self.alive = np.ones(n, np.float32)
        self.pos = None
        self.idx = np.arange(n)

    def respawn(self, f, P, force=False):
        t = f + self.off
        age = np.mod(t, self.L)
        cyc = np.mod(np.floor_divide(t, self.L), self.C)
        sel = self.idx if force else self.idx[age == 0]
        if self.pos is None:
            self.pos = np.zeros((self.n, 2), np.float32)
        if len(sel):
            self.pos[sel] = self.spawn[sel, cyc[sel]]
            cx, cy, a, b, s = eye_geom(P)
            if s > 0.05:
                X = (self.pos[sel, 0] - cx) / a
                Y = (self.pos[sel, 1] - cy) / b
                self.alive[sel] = (X * X + Y * Y > 1.08).astype(np.float32)
            else:
                self.alive[sel] = 1.0
        return age

    def envelope(self, frac):
        a, b = self.fade
        return (smoothstep(0.0, a, frac) * (1.0 - smoothstep(b, 1.0, frac))).astype(np.float32)


class FilmSim:
    BUFS = ("Sm", "Sf", "N", "G", "R")

    def __init__(self):
        rng = np.random.default_rng(R.SEED)
        self.main = FilmField(rng, 22, 380, 1700, 0.50 * R.U0, cycles=(1, 1, 2, 2, 3))
        self.main._mo = 1.9
        self.gold = FilmField(rng, 12, 700, 2300, 0.80 * R.U0, cycles=(1, 2), slope=0.1, mask_in=1.0, mask_out=1.45)
        self.gold._mo = 1.45
        box = (-190, -40, W + 30, H + 40)
        self.far = FLayer(rng, 52000, [150, 180, 200, 225], 0.52, 0.060, 0.55, 2, box, "Sf")
        self.mid = FLayer(rng, 15000, [90, 100, 120, 150], 1.0, 0.150, 0.50, 3, box, "Sm")
        self.near = FLayer(rng, 260, [60, 72, 90], 1.75, 0.85, 0.40, 4, box, "N", fade=(0.25, 0.6))
        self.dust = FLayer(rng, 340, [150, 180, 200, 225], 1.0, 0.17, 0.50, 4, box, "G",
                           own=0.85, carry=0.85, fade=(0.2, 0.7), gain="flat")
        self.hero = FLayer(rng, 3, [600], 1.06, 1.0, 0.0, 12, (-300, 230, -110, H - 230), "R",
                           own=0.50, carry=0.92, fade=(0.12, 0.86), gain="flat")
        self.hero.L[:] = [600, 900, 900]
        self.hero.C = R.LOOP // self.hero.L
        self.hero.off[:] = [120, 420, 870]
        self.hero.w[:] = [4.2, 3.4, 3.8]
        self.layers = [self.far, self.mid, self.near, self.dust, self.hero]
        self.buf = {k: np.zeros(W * H, np.float32) for k in self.BUFS}
        self.decay = {"Sm": 0.955, "Sf": 0.948, "N": 0.86, "G": 0.968, "R": 0.9935}
        self.started = False

    def step(self, f, P):
        fl = f % R.LOOP
        U = R.U0 * P["U"] * (1.0 + 0.10 * math.sin(TAU * fl / R.LOOP + 0.9))
        breath = 1.0 + 0.14 * math.sin(TAU * 2 * fl / R.LOOP + 0.4)
        self.main.update_dyn(f, P, P["turb"])
        self.gold.update_dyn(f, P, 1.0)
        for k, b in self.buf.items():
            b *= self.decay[k]
        for ly in self.layers:
            age = ly.respawn(f, P, force=not self.started)
            gain = breath if ly.gain == "breath" else 1.0
            ss = ly.substeps
            dt = 1.0 / ss
            vref = R.U0 * ly.speed
            pts, wts = [], []

            def vel(p):
                v = flow(p, P, U) + self.main.sample(p)
                if ly.own > 0:
                    v = ly.carry * v + ly.own * self.gold.sample(p)
                return v * ly.speed

            for s in range(ss):
                env = ly.envelope((age + (s + 0.5) * dt) / ly.L) * ly.alive
                k1 = vel(ly.pos)
                k2 = vel(ly.pos + (0.5 * dt) * k1)
                ly.pos = (ly.pos + dt * k2).astype(np.float32)
                spd = np.sqrt(k2[:, 0] ** 2 + k2[:, 1] ** 2) / vref
                pts.append(ly.pos.copy())
                wts.append(ly.w * env * np.clip(spd, 0.06, 2.2).astype(np.float32) * (gain * dt))
            R.bilinear_splat(self.buf[ly.buf], np.concatenate(pts), np.concatenate(wts))
        self.started = True

    def snapshot(self):
        return {k: v.reshape(H, W).copy() for k, v in self.buf.items()}


# ============================================================================
# Compositor
# ============================================================================
COL = {
    "gold": (1.00, 0.64, 0.28),
    "hot": (1.00, 0.86, 0.62),
    "silver": (0.62, 0.70, 0.82),
    "paper": (0.92, 0.88, 0.80),
    "red": (0.95, 0.30, 0.24),
    "cyan": (0.40, 0.75, 0.95),
    "dim": (0.40, 0.46, 0.56),
}
INK_GAIN = {"gold": 0.80, "hot": 1.6, "silver": 0.30, "paper": 0.55, "red": 0.65, "cyan": 0.32, "dim": 0.16}
INK_BLOOM = {"gold": 1.1, "hot": 1.8, "silver": 0.25, "paper": 0.35, "red": 0.8, "cyan": 0.35, "dim": 0.0}


class FilmCompositor:
    SILVER = R.Compositor.SILVER
    SILVER_FAR = R.Compositor.SILVER_FAR
    SILVER_NEAR = R.Compositor.SILVER_NEAR
    GOLD = R.Compositor.GOLD
    GOLD_HOT = R.Compositor.GOLD_HOT
    FOG = R.Compositor.FOG

    def __init__(self):
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        self.xx, self.yy = xx, yy
        nx = (xx - 960) / (W * 0.5)
        ny = (yy - 540) / (H * 0.5)
        r = np.sqrt(nx * nx * 0.85 + ny * ny * 1.15)
        lift = np.exp(-r * r * 1.6)
        top = yy / H
        self.bg = [
            (0.0015 + 0.0058 * lift + 0.0010 * top).astype(np.float32),
            (0.0023 + 0.0084 * lift + 0.0012 * top).astype(np.float32),
            (0.0044 + 0.0150 * lift + 0.0008 * top).astype(np.float32),
        ]
        self.vig = (1.0 - 0.55 * smoothstep(0.55, 1.45, r)).astype(np.float32)
        er = np.sqrt(((xx - 960) / 760.0) ** 2 + ((yy - 532) / 470.0) ** 2)
        self.burst = (0.22 + 0.78 * np.exp(-er * er * 1.3)).astype(np.float32)
        rng = np.random.default_rng(R.SEED + 7)
        self.fogf = R.ModeField(rng, 9, 650, 2200, 1.0, cycles=(1, 1, 2), step=16, pad=0,
                                mask_in=-2, mask_out=-1, ang=(math.pi / 2, 0.55))
        self.static_geo = R.Geometry._static()
        # blueprint grid (aligned to the S4 axes: origin 760,600, unit 70)
        g = np.zeros((H * 2, W * 2), np.uint8)
        for i in range(-12, 20):
            x = 760 + i * 70
            if 0 <= x < W:
                cv2.line(g, (x * 2, 0), (x * 2, H * 2), 120 if i % 5 else 200, 1, cv2.LINE_AA)
        for j in range(-8, 10):
            y = 600 + j * 70
            if 0 <= y < H:
                cv2.line(g, (0, y * 2), (W * 2, y * 2), 120 if j % 5 else 200, 1, cv2.LINE_AA)
        self.grid = cv2.resize(g, (W, H), interpolation=cv2.INTER_AREA).astype(np.float32) / 255.0

    def fog_field(self, f):
        p = self.fogf.psi(f)
        p = (p - p.mean()) / (p.std() + 1e-6)
        fog = cv2.resize(p.astype(np.float32), (W, H), interpolation=cv2.INTER_CUBIC)
        return ne.evaluate("where(fog < -1.6, 0.02, where(fog > 1.6, 0.98, 0.5 + 0.3 * fog))")

    def eye_planes(self, P):
        cx, cy, a, b, s = eye_geom(P)
        if s < 0.02:
            return None, None
        xx, yy = self.xx, self.yy
        rho = ne.evaluate("sqrt(((xx - cx) / a) ** 2 + ((yy - cy) / b) ** 2)")
        k = min(1.0, s * 3)
        vis = ne.evaluate("1 - k + k * where(rho < 0.985, 0, where(rho > 1.5, 1, "
                          "((rho - 0.985) / 0.515) ** 2 * (3 - 2 * (rho - 0.985) / 0.515)))")
        inner = ne.evaluate("exp(-rho * rho * 1.4) * k")
        return vis, inner

    def frame(self, bufs, f, P, ink_alpha, gfx=None, ink_post=None):
        Sm, Sf, N, G, Rr = (bufs[k] for k in FilmSim.BUFS)
        fog = self.fog_field(f)
        vis, inner = self.eye_planes(P)
        if vis is None:
            vis = np.float32(1.0)
            inner = np.float32(0.0)
        sg, gg, hg = P["sgain"], P["ggain"], P["hgain"]
        Sf = cv2.GaussianBlur(Sf, (0, 0), 0.75)
        Nb = cv2.GaussianBlur(N, (0, 0), 5.0)
        Im = ne.evaluate("(1 - exp(-Sm * 1.05)) * vis * (0.20 + 1.50 * fog * fog) * sg")
        If = ne.evaluate("(1 - exp(-Sf * 1.0)) * vis * (0.30 + 1.0 * fog) * sg")
        In = ne.evaluate("(1 - exp(-Nb * 1.7)) * vis * (0.35 + 0.9 * fog) * sg")
        Ig = ne.evaluate("(1 - exp(-G * 1.0)) * vis * gg")
        Ir = ne.evaluate("(1 - exp(-Rr * 1.3)) * hg")
        Ic = ne.evaluate("where(Rr * 0.6 - 0.3 > 0, where(Rr * 0.6 - 0.3 < 1, Rr * 0.6 - 0.3, 1), 0) * hg")

        q = lambda a: cv2.resize(a, (W // 4, H // 4), interpolation=cv2.INTER_AREA)
        qm, qn, qg, qr = q(Im), q(In), q(Ig), q(Ir)
        src = [qm * (0.20 * self.SILVER[c]) + qn * (0.30 * self.SILVER_NEAR[c]) +
               qg * (0.95 * self.GOLD[c]) + qr * (1.35 * self.GOLD[c]) for c in range(3)]
        for name, a in ink_alpha.items():
            if INK_BLOOM[name] > 0:
                qa = q(a)
                for c in range(3):
                    src[c] = src[c] + qa * (COL[name][c] * INK_BLOOM[name])
        if gfx is not None:
            for c in range(3):
                src[c] = src[c] + q(gfx[c]) * 0.55
        bl = R.Compositor.bloom(np.stack(src, axis=-1))

        tint, bgt = P["tint"], P["bgtint"]
        geo = self.static_geo * 0.075
        if P["grid"] > 0.002:
            geo = geo + self.grid * (0.075 * P["grid"])
        planes = []
        exposure = P["exposure"]
        for c in range(3):
            bg = self.bg[c] * bgt[c]
            b = bl[..., c]
            tc = tint[c]
            cs, cf, cn = self.SILVER[c] * 0.80 * tc, self.SILVER_FAR[c] * 0.44 * tc, self.SILVER_NEAR[c] * 0.34 * tc
            cg, cr, ch = self.GOLD[c] * 0.80, self.GOLD[c] * 0.95, self.GOLD_HOT[c]
            cfog, chair = self.FOG[c] * bgt[c], R.Compositor.HAIR[c]
            cin = (0.0040, 0.0031, 0.0022)[c]
            L = ne.evaluate("bg + fog * cfog + inner * cin + Im * cs + If * cf + In * cn + Ig * cg + Ir * cr"
                            " + Ic * ch + b * 0.55 + geo * chair")
            for name, a in ink_alpha.items():
                k = float(COL[name][c] * INK_GAIN[name])
                ne.evaluate("L + a * k", out=L)
            if gfx is not None:
                gc = gfx[c]
                ne.evaluate("L + gc", out=L)
            planes.append(L)

        # camera: zoom about a point, with radial motion blur during warps
        z, mb = P["zoom"], P["mblur"]
        if abs(z - 1.0) > 1e-4 or mb > 1e-3 or abs(P["roll"]) > 1e-3:
            planes = self.zoom(planes, z, P["zoom_cx"], P["zoom_cy"], mb, roll=P["roll"], ca=P["ca"])
        if ink_post:                       # elements that ride on top of the camera (warp tunnel)
            for name, a in ink_post.items():
                for c in range(3):
                    kk = float(COL[name][c] * INK_GAIN[name] * 1.4)
                    L = planes[c]
                    ne.evaluate("L + a * kk", out=L)
        fl = P["flash"]
        vig = self.vig
        burst = self.burst
        out = []
        for c in range(3):
            L = planes[c]
            fc = (1.0, 0.86, 0.66)[c] * fl
            out.append(ne.evaluate("sqrt((L * vig * exposure + fc * burst) / (1 + 0.6 * (L * vig * exposure + fc * burst)))"))
        r, g, b = out
        tone = ne.evaluate("(r + g + b) / 3 * (1 - (r + g + b) / 3)")
        ne.evaluate("r + tone * 0.010", out=r)
        ne.evaluate("b - tone * 0.012", out=b)
        return out

    @staticmethod
    def zoom(planes, z, cx, cy, mb, n=None, roll=0.0, ca=0.0):
        """Scale (and roll) about (cx,cy). mb = relative scale spread for radial
        motion blur; ca = per-channel scale offset (lens-like chromatic fringing)."""
        if n is None:
            n = 1 if mb < 0.004 else int(min(14, 3 + mb * 40))
        acc = [np.zeros((H, W), np.float32) for _ in range(3)]
        for i in range(n):
            s = z * (1.0 + mb * (i / max(n - 1, 1) - 0.5)) if n > 1 else z
            for c in range(3):
                sc = s * (1.0 + ca * (1 - c))                 # R larger, B smaller
                M = cv2.getRotationMatrix2D((cx, cy), roll, sc)
                acc[c] += cv2.warpAffine(planes[c], M, (W, H), flags=cv2.INTER_LINEAR,
                                         borderMode=cv2.BORDER_REFLECT)
        return [a * (1.0 / n) for a in acc]
