"""HAIZ · 校园漫步 V2 — painted cumulus cards.

Background painters do not draw clouds as noise. They draw a few large masses with a flat base,
domed towers and a cauliflower rim, keep the inside soft (one lit side, one shaded side, a cool
underside) and make the silhouette crisp. Each card here is built that way and stored so the
real-time sky can light it from the sun's actual direction:

  R, G   the surface normal's x and up components (0.5 = facing the viewer); the cloud is treated
         as a bulge toward the eye, so a normal map is enough to shade it from any sun direction
  B      thickness (0 at the rim, 1 in the thickest core): cores shade deeper, rims let light through
  A      signed distance to the silhouette (0.5 on the edge), so the edge stays crisp at any size

Layout of the 2048×2048 atlas: 2 columns × 4 rows of 1024×512 cells.
  0–1  towering cumulus (the composition's hero masses)
  2–3  broad cumulus banks
  4–5  medium clusters
  6–7  small fair-weather puffs (several per cell)

Only numpy and Pillow are needed. Run: python3 scripts/stroll/build_clouds.py
"""
import math
import os
import random

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'lanren', 'assets', 'stroll')
os.makedirs(OUT, exist_ok=True)

CW, CH = 1024, 512
SPREAD = 32.0          # px of signed distance encoded either side of the edge (at bake resolution)


def box_blur(a, r, axis):
    if r < 1:
        return a
    c = np.cumsum(np.pad(a, [(r + 1, r) if i == axis else (0, 0) for i in range(a.ndim)], mode='edge'), axis=axis)
    n = a.shape[axis]
    hi = np.take(c, np.arange(2 * r + 1, 2 * r + 1 + n), axis=axis)
    lo = np.take(c, np.arange(0, n), axis=axis)
    return (hi - lo) / (2 * r + 1)


def blur(a, r):
    for _ in range(3):
        a = box_blur(box_blur(a, r, 0), r, 1)
    return a


class Cloud:
    def __init__(self, seed):
        self.r = random.Random(seed)
        self.blobs = []           # (x, y, radius) in px, y down

    def add(self, x, y, rad):
        self.blobs.append((x, y, rad))

    def top_at(self, x):
        """the highest blob surface above x (smallest y), or None"""
        best = None
        for bx, by, br in self.blobs:
            dx = abs(x - bx)
            if dx < br:
                y = by - math.sqrt(br * br - dx * dx)
                best = y if best is None else min(best, y)
        return best

    def billow(self, n, rmin, rmax, x0, x1, inset=0.45):
        """lobes along the current upper contour, spaced like a cauliflower rim (not random scatter)"""
        x = x0 + self.r.uniform(0, rmax)
        placed = 0
        while x < x1 and placed < n:
            rad = self.r.uniform(rmin, rmax)
            t = self.top_at(x)
            if t is not None:
                self.add(x + self.r.uniform(-0.15, 0.15) * rad, t + rad * inset, rad)
                placed += 1
            x += rad * self.r.uniform(1.15, 1.5)

    def fields(self, base_y, w=CW, h=CH):
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        k = 0.12                                            # smooth-union sharpness (1/px)
        acc = np.zeros((h, w), np.float64)
        prof = np.zeros((h, w), np.float32)                 # each lobe's own sphere (creases between lobes define them)
        m = max(r for _, _, r in self.blobs)
        for bx, by, br in self.blobs:
            x0, x1 = int(max(0, bx - br - 40)), int(min(w, bx + br + 40))
            y0, y1 = int(max(0, by - br - 40)), int(min(h, by + br + 40))
            if x1 <= x0 or y1 <= y0:
                continue
            d = np.sqrt((xx[y0:y1, x0:x1] - bx) ** 2 + (yy[y0:y1, x0:x1] - by) ** 2)
            acc[y0:y1, x0:x1] += np.exp(k * (br - d - m))
            p = np.sqrt(np.clip(br * br - d * d, 0, None))
            prof[y0:y1, x0:x1] = np.maximum(prof[y0:y1, x0:x1], p)
        sd = np.where(acc > 0, np.log(np.maximum(acc, 1e-300)) / k + m, -1e3).astype(np.float32)
        # a flat, slightly ragged base: clouds sit on their condensation level
        ragged = base_y + 4 * np.sin(xx / 37.0) + 3 * np.sin(xx / 13.0 + 1.3)
        sd = np.minimum(sd, ragged - yy)
        prof = np.where(yy > ragged, 0, prof)
        # painterly rim: a little high-frequency wobble on the distance only
        rng = np.random.default_rng(self.r.randrange(1 << 30))
        wob = blur(rng.standard_normal((h, w)).astype(np.float32), 2) * 3.0
        sd = sd + wob * np.clip(1 - np.abs(sd) / 10, 0, 1)
        return sd, prof

    def bake(self, base_y):
        sd, prof = self.fields(base_y)
        # broad volume: a dome raised from the silhouette's own distance field (no holes between lobes)
        dome = blur(np.sqrt(np.clip(sd, 0, None) * 110.0), 10)
        # lobe detail: each lobe's sphere, felt only near the rim, where painters draw the billows
        lobes = blur(prof, 3)
        gym, gxm = np.gradient(dome)
        gyd, gxd = np.gradient(lobes)
        rim = np.clip(1 - np.maximum(sd, 0) / 55.0, 0, 1) * 0.75
        gx, gy = gxm + gxd * rim, gym + gyd * rim
        p = dome
        nx, nup, nz = -gx, gy, np.ones_like(p)
        L = np.sqrt(nx * nx + nup * nup + nz * nz)
        nx, nup = nx / L, nup / L
        thick = p / max(1.0, float(p.max()))
        inside = sd > -2
        img = np.zeros((CH, CW, 4), np.uint8)
        img[..., 0] = np.clip((nx * 0.5 + 0.5) * 255, 0, 255)
        img[..., 1] = np.clip((nup * 0.5 + 0.5) * 255, 0, 255)
        img[..., 2] = np.clip(np.where(inside, thick, 0) * 255, 0, 255)
        img[..., 3] = np.clip((0.5 + sd / (2 * SPREAD)) * 255, 0, 255)
        # outside the shape keep a neutral normal so filtering at the rim does not tilt it
        out = sd < -SPREAD
        img[out, 0] = 128
        img[out, 1] = 128
        return img


def towering(seed):
    c = Cloud(seed)
    r = c.r
    base = CH - 40
    cx = CW * r.uniform(0.44, 0.56)
    # broad foot
    for i in range(7):
        x = cx + (i - 3) * r.uniform(68, 88)
        rad = r.uniform(70, 100) * (1 - abs(i - 3) * 0.13)
        c.add(x, base - rad * 0.42, rad)
    # the tower: stacked domes, narrowing upward, a slight lean
    lean = r.uniform(-0.12, 0.12)
    y = base - 110
    for k in range(5):
        rad = 112 * (1 - k * 0.16) * r.uniform(0.92, 1.05)
        y -= rad * 0.66
        x = cx + lean * (base - y)
        c.add(x, y, rad)
        for j in (-1, 1):
            c.add(x + j * rad * 0.62, y + rad * 0.42, rad * 0.72)
    c.billow(30, 26, 52, cx - 320, cx + 320)
    c.billow(46, 11, 24, cx - 350, cx + 350, 0.5)
    return c, base


def bank(seed):
    c = Cloud(seed)
    r = c.r
    base = CH - 60
    x = 80
    while x < CW - 80:
        rad = r.uniform(55, 95)
        c.add(x, base - rad * 0.45, rad)
        x += rad * r.uniform(0.8, 1.1)
    # domes along the top at irregular intervals, taller toward the middle
    x = 120
    while x < CW - 120:
        h = 0.45 + 0.55 * math.sin(math.pi * x / CW)
        rad = r.uniform(55, 90) * (0.7 + 0.5 * h)
        c.add(x, base - 70 - h * r.uniform(40, 120), rad)
        x += r.uniform(90, 170)
    c.billow(34, 24, 48, 90, CW - 90)
    c.billow(56, 10, 22, 70, CW - 70, 0.5)
    return c, base


def cluster(seed):
    c = Cloud(seed)
    r = c.r
    base = CH - 90
    cx = CW * 0.5
    for i in range(5):
        x = cx + (i - 2) * r.uniform(60, 85)
        rad = r.uniform(55, 85) * (1 - abs(i - 2) * 0.15)
        c.add(x, base - rad * 0.5 - (2 - abs(i - 2)) * r.uniform(15, 35), rad)
    c.billow(18, 22, 42, cx - 230, cx + 230)
    c.billow(30, 9, 18, cx - 250, cx + 250, 0.5)
    return c, base


def puffs(seed):
    c = Cloud(seed)
    r = c.r
    base = CH - 120
    for p in range(3):
        cx = CW * (0.2 + 0.3 * p) + r.uniform(-30, 30)
        bb = base - r.uniform(0, 60)
        for i in range(3):
            rad = r.uniform(30, 48)
            c.add(cx + (i - 1) * rad * 0.9, bb - rad * 0.5 - (12 if i == 1 else 0), rad)
        c.billow(6, 12, 22, cx - 90, cx + 90)
    return c, base


def main():
    atlas = np.zeros((CH * 4, CW * 2, 4), np.uint8)
    makers = [towering, towering, bank, bank, cluster, cluster, puffs, puffs]
    for i, mk in enumerate(makers):
        c, base = mk(2611 + i * 97)
        img = c.bake(base)
        row, col = i // 2, i % 2
        atlas[row * CH:(row + 1) * CH, col * CW:(col + 1) * CW] = img
        print('cell', i, mk.__name__, len(c.blobs), 'blobs')
    path = os.path.join(OUT, 'clouds.png')
    # baked at 2048, shipped at 1024: the silhouette is a distance field and the shading is smooth,
    # so half the texels keep crisp edges at a quarter of the memory and download
    Image.fromarray(atlas, 'RGBA').resize((CW, CH * 2), Image.LANCZOS).save(path, optimize=True)
    print('wrote', path, os.path.getsize(path) // 1024, 'KiB')


if __name__ == '__main__':
    main()
