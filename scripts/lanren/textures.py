#!/usr/bin/env python3
"""HAIZ · 一棵榄仁树 — texture generator.

Produces every raster the realtime scene needs, deterministically, from
numbers only (no photographs are traced or resampled):

  lanren/assets/leaf-atlas.png   RGBA, 4 leaf variants side by side
        R  luminance detail (lamina tone, reticulation, blemishes)
        G  vein mask (midrib + 6-9 lateral pairs)
        B  senescence order: where colour change begins (0) and ends (1)
        A  coverage
  lanren/assets/leaf-normal.png  tangent-space normal (veins sunken on top)
  lanren/assets/bark-color.jpg / bark-normal.jpg   tileable, fissured, lichen
  lanren/assets/paving-color.jpg / paving-normal.jpg  600 mm stone flags

Leaf form follows published descriptions of Terminalia catappa: obovate,
widest in the upper third, cuneate base with a slight auricle, broadly
rounded apex with a short point, 6-9 pairs of arching lateral veins.

Run:  python3 scripts/lanren/textures.py
"""
import math
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'lanren', 'assets')
os.makedirs(OUT, exist_ok=True)


# ---------------------------------------------------------------- helpers
def periodic_noise(shape, beta=2.0, aniso=(1.0, 1.0), seed=0, lo=0.0):
    """Tileable 1/f^beta noise made in the frequency domain (wraps exactly)."""
    rng = np.random.default_rng(seed)
    h, w = shape
    fy = np.fft.fftfreq(h)[:, None] * aniso[0]
    fx = np.fft.fftfreq(w)[None, :] * aniso[1]
    f = np.sqrt(fx * fx + fy * fy)
    f[0, 0] = 1.0
    amp = 1.0 / np.power(f, beta / 2.0)
    if lo > 0:
        amp *= 1.0 - np.exp(-(f / lo) ** 2)
    amp[0, 0] = 0.0
    phase = rng.uniform(0, 2 * math.pi, size=(h, w))
    spec = amp * np.exp(1j * phase)
    n = np.real(np.fft.ifft2(spec))
    n -= n.mean()
    n /= (n.std() + 1e-9)
    return n


def value_noise(x, y, seed, freq):
    """Smooth non-periodic noise sampled at arbitrary coordinates."""
    rng = np.random.default_rng(seed)
    g = rng.random((64, 64))
    xs = (x * freq) % 63
    ys = (y * freq) % 63
    x0 = np.floor(xs).astype(int)
    y0 = np.floor(ys).astype(int)
    fx = xs - x0
    fy = ys - y0
    fx = fx * fx * (3 - 2 * fx)
    fy = fy * fy * (3 - 2 * fy)
    a = g[y0, x0]
    b = g[y0, x0 + 1]
    c = g[y0 + 1, x0]
    d = g[y0 + 1, x0 + 1]
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def fbm(x, y, seed, freq, octaves=4):
    total = 0.0
    amp = 0.5
    for o in range(octaves):
        total = total + amp * value_noise(x, y, seed + o * 17, freq * (2 ** o))
        amp *= 0.5
    return total


def worley_f21(x, y, seed):
    """F2 - F1 cellular distance on a jittered unit grid (cell walls ~ 0)."""
    rng = np.random.default_rng(seed)
    jit = rng.random((128, 128, 2))
    ix, iy = np.floor(x).astype(int), np.floor(y).astype(int)
    f1 = np.full(x.shape, 9.0)
    f2 = np.full(x.shape, 9.0)
    for oy in (-1, 0, 1):
        for ox in (-1, 0, 1):
            cx, cy = ix + ox, iy + oy
            j = jit[cy % 128, cx % 128]
            px, py = cx + j[..., 0], cy + j[..., 1]
            d = np.sqrt((px - x) ** 2 + (py - y) ** 2)
            f2 = np.where(d < f1, f1, np.minimum(f2, d))
            f1 = np.minimum(f1, d)
    return f2 - f1


def normal_from_height(hgt, strength, wrap=True):
    if wrap:
        dx = (np.roll(hgt, -1, 1) - np.roll(hgt, 1, 1)) * 0.5
        dy = (np.roll(hgt, -1, 0) - np.roll(hgt, 1, 0)) * 0.5
    else:
        dy, dx = np.gradient(hgt)
    nx = -dx * strength
    ny = dy * strength  # image rows go down; OpenGL normal maps are +Y up
    nz = np.ones_like(hgt)
    l = np.sqrt(nx * nx + ny * ny + nz * nz)
    n = np.stack([nx / l, ny / l, nz / l], -1)
    return ((n * 0.5 + 0.5) * 255).clip(0, 255).astype(np.uint8)


def equalize(a, mask):
    """Map values inside mask to a uniform 0..1 distribution (rank order)."""
    out = np.zeros_like(a)
    v = a[mask]
    order = np.argsort(v, kind='mergesort')
    ranks = np.empty_like(order, dtype=np.float64)
    ranks[order] = np.linspace(0, 1, len(v))
    out[mask] = ranks
    return out


def save_rgb(arr, name, quality=None):
    img = Image.fromarray(arr)
    path = os.path.join(OUT, name)
    if name.endswith('.jpg'):
        img.save(path, quality=quality or 88, optimize=True, progressive=True)
    else:
        img.save(path, optimize=True)
    print('wrote', os.path.relpath(path, ROOT), img.size)


# ---------------------------------------------------------------- leaves
LEAF_W, LEAF_H = 512, 1024     # one cell of the atlas
SS = 2                         # supersampling


def leaf_variant(idx, seed):
    rng = np.random.default_rng(seed)
    H, W = LEAF_H * SS, LEAF_W * SS
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float64)
    # leaf-local coordinates: t from petiole tip (0) to apex (1); x in metres-ish
    t_base, t_apex = 0.075, 0.975          # petiole occupies the bottom strip
    t = (H - 1 - yy) / (H - 1)
    t = (t - t_base) / (t_apex - t_base)
    x = (xx - (W - 1) / 2) / ((W - 1) / 2)  # -1..1

    # slight asymmetry + overall curvature of the midrib
    bend = rng.uniform(-0.05, 0.05)
    mid = bend * np.sin(np.clip(t, 0, 1) * math.pi) + rng.uniform(-0.015, 0.015) * t
    xr = x - mid

    # obovate outline
    a, b = 0.86 + rng.uniform(-0.06, 0.06), 0.33 + rng.uniform(-0.04, 0.05)
    tc = np.clip(t, 1e-4, 1 - 1e-4)
    f = tc ** a * (1 - tc) ** b
    fmax = (a / (a + b)) ** a * (b / (a + b)) ** b
    f = f / fmax
    # auricle: base flares slightly then pinches to the petiole
    f += 0.07 * np.exp(-((tc - 0.06) / 0.035) ** 2)
    # short acumen at the apex
    f *= 1.0 - 0.18 * np.exp(-((1 - tc) / 0.06) ** 2) * (1 - np.exp(-(xr / 0.03) ** 2))
    width = 0.94 + rng.uniform(-0.05, 0.03)
    asym = 1.0 + np.sign(xr) * rng.uniform(0.0, 0.05)
    # gently undulating entire margin
    wav = 1.0 + 0.012 * np.sin(tc * 38 + seed) + 0.008 * np.sin(tc * 91 + seed * 2)
    halfw = width * f * asym * wav
    inside = (np.abs(xr) < halfw) & (t > 0) & (t < 1)

    # normalised coordinates across the lamina
    s = np.clip(np.abs(xr) / np.maximum(halfw, 1e-4), 0, 1)
    edge = 1 - s                                  # 1 at midrib, 0 at margin
    # distance from margin in pixels (approx) for antialias + margin tone
    edge_px = (halfw - np.abs(xr)) * (W / 2)

    # ---- veins
    midrib_w = 0.016 * (1.15 - 0.85 * np.clip(t, 0, 1))
    midrib = np.exp(-(xr / midrib_w) ** 2)
    n_pairs = int(rng.integers(7, 10))
    lateral = np.zeros_like(t)
    lat_axis = np.zeros_like(t)
    for side in (-1, 1):
        starts = np.linspace(0.07, 0.86, n_pairs) + rng.uniform(-0.018, 0.018, n_pairs)
        for k, t0 in enumerate(starts):
            rise = 0.20 + 0.10 * t0 + rng.uniform(-0.02, 0.03)
            # vein path: t = t0 + rise * s^1.35 (arching towards the apex)
            sel = (np.sign(xr) == side)
            tv = t0 + rise * np.power(s, 1.35)
            d = (t - tv)
            w = 0.0055 * (1.0 - 0.75 * s) + 0.0012
            v = np.exp(-(d / w) ** 2) * (s < 0.93) * sel
            lateral = np.maximum(lateral, v * (1 - 0.45 * s))
            lat_axis = np.maximum(lat_axis, np.exp(-(d / (w * 5)) ** 2) * sel)
    # tertiary reticulation: thin cell walls from a stretched voronoi-ish noise
    cellx = xx / W * 34
    celly = yy / H * 58
    f21 = worley_f21(cellx, celly, seed + 99)
    retic = np.exp(-(f21 / 0.07) ** 2)

    veins = np.clip(np.maximum(midrib, lateral * 0.85) + 0.3 * retic * (1 - midrib), 0, 1)

    # ---- lamina tone
    n1 = fbm(xx / W, yy / H, seed, 6, 4)
    n2 = fbm(xx / W, yy / H, seed + 7, 22, 3)
    tone = 0.70 + 0.16 * (n1 - 0.5) + 0.06 * (n2 - 0.5)
    tone += 0.045 * veins + 0.03 * midrib      # veins only slightly paler on the upper side
    tone -= 0.05 * np.exp(-(edge_px / (6 * SS)) ** 2)   # darker rim
    # interveinal bulge (light between veins, slightly darker beside them)
    tone += 0.035 * (lat_axis - lateral)

    # blemishes: a few dry spots and, on one variant, a caterpillar bite
    blem = np.zeros_like(t)
    for _ in range(int(rng.integers(2, 6))):
        cx, cy = rng.uniform(-0.6, 0.6), rng.uniform(0.15, 0.9)
        r = rng.uniform(0.012, 0.035)
        dist = np.sqrt(((xr - cx) / 1.0) ** 2 + ((t - cy) * 1.9) ** 2)
        blem = np.maximum(blem, np.exp(-(dist / r) ** 4))
    tone -= 0.22 * blem
    hole = np.zeros_like(inside)
    if idx == 2:
        cx, cy = 0.62 * np.sign(rng.uniform(-1, 1)), 0.55
        dist = np.sqrt((xr - cx) ** 2 + ((t - cy) * 1.7) ** 2)
        wob = 1 + 0.25 * np.sin(np.arctan2(t - cy, xr - cx) * 7)
        hole = dist < 0.11 * wob
    if idx == 3:  # small margin tear
        cx = -np.sign(rng.uniform(-1, 1)) * 0.85
        dist = np.sqrt((xr - cx) ** 2 + ((t - 0.42) * 3.0) ** 2)
        hole = dist < 0.09

    # ---- senescence order (0 = first to colour, 1 = last)
    low = fbm(xx / W, yy / H, seed + 31, 3.2, 4)
    mid_m = fbm(xx / W, yy / H, seed + 53, 9.0, 3)
    # interveinal mottling: patches bounded by the lateral veins
    mott = mid_m * (1 - 0.6 * lat_axis)
    sen = 0.22 * (1 - np.clip(edge * 2.2, 0, 1)) + 0.65 * low + 0.45 * mott + 0.25 * blem \
        - 0.10 * veins + 0.10 * (1 - np.clip(t, 0, 1))
    # apex region colours slightly earlier
    sen += 0.08 * np.clip(t - 0.6, 0, 1)
    sen = -sen
    lam = inside & ~hole

    # ---- petiole: short, thick, slightly curved
    tp = (H - 1 - yy) / (H - 1)
    pet_mask = (tp >= 0.0) & (tp <= t_base + 0.01)
    pet_x = (x - 0.0 - 0.02 * (t_base - tp) / t_base)
    pet_w = 0.028 + 0.012 * tp / t_base
    petiole = pet_mask & (np.abs(pet_x) < pet_w)

    cover = lam | petiole
    sen_eq = equalize(sen, lam)
    sen_eq[petiole] = 0.98
    # midrib & petiole turn last-but-ish; keep them coherent
    sen_eq = np.where(lam, sen_eq * (1 - 0.35 * midrib) + 0.35 * midrib * 0.9, sen_eq)

    R = np.where(petiole, 0.62, tone)
    G = np.where(petiole, 1.0, veins)
    B = sen_eq
    A = cover.astype(np.float64)

    # height for normals: veins sunken on adaxial side, bulging lamina between
    hgt = -0.9 * veins + 0.35 * lat_axis + 0.15 * (n2 - 0.5)
    hgt = np.where(cover, hgt, 0)
    hgt = np.where(petiole, 0.8, hgt)

    def down(a):
        return a.reshape(LEAF_H, SS, LEAF_W, SS).mean(axis=(1, 3))

    rgba = np.stack([down(R), down(G), down(B), down(A)], -1)
    nrm = normal_from_height(down(hgt), 3.2, wrap=False)
    return rgba, nrm


def build_leaf_atlas():
    cells, normals = [], []
    for i, seed in enumerate([11, 23, 47, 71]):
        rgba, nrm = leaf_variant(i, seed)
        cells.append(rgba)
        normals.append(nrm)
        print('leaf variant', i, 'coverage %.3f' % rgba[..., 3].mean())
    atlas = np.concatenate(cells, axis=1)
    # dilate colour channels into transparent texels to avoid dark fringes
    a = atlas[..., 3]
    col = atlas[..., :3].copy()
    known = a > 0.02
    for _ in range(12):
        acc = np.zeros_like(col)
        cnt = np.zeros(a.shape)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            sh = np.roll(np.roll(col, dy, 0), dx, 1)
            sk = np.roll(np.roll(known, dy, 0), dx, 1)
            acc += sh * sk[..., None]
            cnt += sk
        grow = (~known) & (cnt > 0)
        col[grow] = acc[grow] / cnt[grow][:, None]
        known = known | grow
    atlas[..., :3] = col
    out = (atlas * 255).round().clip(0, 255).astype(np.uint8)
    os.makedirs(os.path.join(ROOT, 'build', 'lanren'), exist_ok=True)
    Image.fromarray(out, 'RGBA').save(os.path.join(ROOT, 'build', 'lanren', 'leaf-atlas-full.png'), optimize=True)  # source only
    nrm = np.concatenate(normals, axis=1)
    Image.fromarray(nrm).save(os.path.join(ROOT, 'build', 'lanren', 'leaf-normal-full.png'))  # source only
    # runtime sizes: 256x512 per leaf is ample for blades on screen; the full
    # 512x1024 atlas is only fetched for the close-up specimen card
    Image.fromarray(out, 'RGBA').save(os.path.join(OUT, 'leaf-atlas-web.png'), optimize=True)
    Image.fromarray(nrm).save(os.path.join(OUT, 'leaf-normal-web.png'), optimize=True)
    Image.fromarray(out, 'RGBA').resize((1024, 512), Image.LANCZOS).save(
        os.path.join(OUT, 'leaf-atlas-lo.png'), optimize=True)
    Image.fromarray(nrm).resize((1024, 512), Image.LANCZOS).save(
        os.path.join(OUT, 'leaf-normal-lo.png'), optimize=True)
    print('wrote web leaf atlases')
    # a coloured preview for docs (not used at runtime)
    preview_leaf_colours(out)


def preview_leaf_colours(atlas):
    """Same colour math as the shader, for docs/visual QA."""
    a = atlas.astype(np.float64) / 255
    rows = []
    for age in (0.0, 0.45, 0.7, 0.9, 1.0):
        lum, vein, sen, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
        green = np.array([0.20, 0.36, 0.11])
        yellow = np.array([0.80, 0.60, 0.12])
        red = np.array([0.62, 0.10, 0.06])
        brown = np.array([0.36, 0.20, 0.10])
        k1 = np.clip((age * 1.35 - sen) * 6 + 0.5, 0, 1)[..., None]
        k2 = np.clip((age * 1.35 - 0.35 - sen) * 6 + 0.5, 0, 1)[..., None]
        k3 = np.clip((age * 1.35 - 0.95 - sen) * 4 + 0.5, 0, 1)[..., None]
        c = green * (1 - k1) + yellow * k1
        c = c * (1 - k2) + red * k2
        c = c * (1 - k3) + brown * k3
        c = c * (lum[..., None] * 1.25) + vein[..., None] * 0.06
        bg = np.array([0.95, 0.93, 0.88])
        img = c * al[..., None] + bg * (1 - al[..., None])
        rows.append(img)
    pv = np.concatenate(rows, 0)
    pv = (np.clip(pv, 0, 1) ** (1 / 1.0) * 255).astype(np.uint8)
    im = Image.fromarray(pv).resize((pv.shape[1] // 4, pv.shape[0] // 4), Image.LANCZOS)
    os.makedirs(os.path.join(ROOT, 'docs', 'lanren'), exist_ok=True)
    im.save(os.path.join(ROOT, 'docs', 'lanren', 'leaf-ageing-preview.jpg'), quality=88)
    print('wrote docs/lanren/leaf-ageing-preview.jpg')


# ---------------------------------------------------------------- bark
def worley_periodic(x, y, nx, ny, seed):
    """F1, F2 cellular distances on a jittered grid that wraps every (nx, ny) cells."""
    rng = np.random.default_rng(seed)
    jit = rng.random((ny, nx, 2)) * 0.8 + 0.1
    ix, iy = np.floor(x).astype(int), np.floor(y).astype(int)
    f1 = np.full(x.shape, 9.0)
    f2 = np.full(x.shape, 9.0)
    for oy in (-1, 0, 1):
        for ox in (-1, 0, 1):
            cx, cy = ix + ox, iy + oy
            j = jit[cy % ny, cx % nx]
            d = np.sqrt((cx + j[..., 0] - x) ** 2 + (cy + j[..., 1] - y) ** 2)
            f2 = np.where(d < f1, f1, np.minimum(f2, d))
            f1 = np.minimum(f1, d)
    return f1, f2


def build_bark(size=1024):
    """Old Terminalia bark: grey-brown, broken by long, shallow-to-deep
    longitudinal fissures into fibrous plates; pale lichen, a little moss.
    U runs round the branch, V along it (fissures follow the grain)."""
    S = size
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float64)
    u, v = xx / S, yy / S
    # warp the lattice so plates meander and merge like real bark
    wx = periodic_noise((S, S), beta=3.0, aniso=(1.0, 0.45), seed=3) * 0.55
    wy = periodic_noise((S, S), beta=3.0, aniso=(1.0, 1.0), seed=4) * 0.9
    NX, NY = 11, 3
    f1, f2 = worley_periodic(u * NX + wx * 0.6, v * NY + wy * 0.35, NX, NY, 7)
    crack = np.clip((f2 - f1) / 0.42, 0, 1)                    # 0 in fissures, 1 on plates
    crack = crack ** 0.75
    # fine fibres along the grain, and flakes peeling off the plates
    fib = periodic_noise((S, S), beta=1.7, aniso=(1.0, 0.07), seed=9)
    flake_f1, flake_f2 = worley_periodic(u * 26 + wx, v * 9 + wy * 0.5, 26, 9, 11)
    flake = np.clip((flake_f2 - flake_f1) / 0.12, 0, 1)
    broad = periodic_noise((S, S), beta=2.8, seed=13)
    hgt = 0.78 * crack + 0.08 * flake * crack + 0.05 * fib + 0.05 * broad
    hgt = hgt - 0.25 * (1 - crack) ** 3
    hgt -= hgt.min()
    hgt /= hgt.max()

    lichen_n = periodic_noise((S, S), beta=3.2, seed=17)
    lichen = np.clip((lichen_n - 1.3) * 0.9, 0, 0.7) * np.clip(crack * 1.6 - 0.4, 0, 1) * np.clip(fib * 0.5 + 0.7, 0, 1)
    lich_dots = np.clip(periodic_noise((S, S), beta=0.9, seed=19) - 1.7, 0, 1) * 0.8 * crack
    moss_n = periodic_noise((S, S), beta=2.9, seed=23)
    moss = np.clip((moss_n - 0.7) * 1.3, 0, 1) * (0.35 + 0.65 * (1 - crack))

    tone = periodic_noise((S, S), beta=2.2, seed=29)
    plate = np.array([0.205, 0.180, 0.150]) * (1 + 0.10 * tone[..., None]) * (0.92 + 0.08 * fib[..., None].clip(-1.5, 1.5))
    plate2 = np.array([0.150, 0.118, 0.090])
    fissure = np.array([0.040, 0.030, 0.023])
    k = hgt[..., None]
    col = fissure + (plate2 * (1 - flake[..., None]) * 0.6 + plate * (0.4 + 0.6 * flake[..., None]) - fissure) * np.clip(k * 1.25, 0, 1)
    col = col * (1 - lichen[..., None] * 0.8) + np.array([0.36, 0.37, 0.31]) * lichen[..., None] * 0.8
    col = col * (1 - lich_dots[..., None]) + np.array([0.44, 0.43, 0.38]) * lich_dots[..., None]
    col = col * (1 - moss[..., None] * 0.75) + np.array([0.075, 0.105, 0.035]) * moss[..., None] * 0.75
    srgb = np.power(np.clip(col, 0, 1), 1 / 2.2)
    save_rgb((srgb * 255).astype(np.uint8), 'bark-color.jpg', 88)
    # normal from height; the alpha-free roughness hint lives in the shader
    save_rgb(normal_from_height(hgt * 5.0, 4.0), 'bark-normal.jpg', 90)


# ---------------------------------------------------------------- paving
def build_paving(size=1024, tiles=4):
    """600 mm square granite-like flags with 6 mm joints, 4x4 per tile repeat."""
    S = size
    cell = S // tiles
    yy, xx = np.mgrid[0:S, 0:S]
    tx, ty = xx // cell, yy // cell
    lx, ly = xx % cell, yy % cell
    joint_px = 2
    jd = np.minimum(np.minimum(lx, cell - 1 - lx), np.minimum(ly, cell - 1 - ly)).astype(float)
    joint = np.clip(1 - (jd - joint_px) / 2.0, 0, 1)
    rng = np.random.default_rng(29)
    tint = rng.uniform(-1, 1, (tiles, tiles))
    warm = rng.uniform(-1, 1, (tiles, tiles))
    grain = periodic_noise((S, S), beta=0.9, seed=31)
    blotch = periodic_noise((S, S), beta=2.6, seed=37)
    stain = np.clip(periodic_noise((S, S), beta=3.2, seed=41) - 0.6, 0, 2)
    base = np.array([0.40, 0.365, 0.315])
    c = base * (1 + 0.08 * tint[ty, tx][..., None]) \
        + np.array([0.03, 0.01, -0.02]) * warm[ty, tx][..., None]
    c = c * (1 + 0.07 * grain[..., None] + 0.06 * blotch[..., None])
    c = c * (1 - 0.18 * stain[..., None].clip(0, 1))
    c = c * (1 - joint[..., None] * 0.8) + np.array([0.20, 0.185, 0.16]) * joint[..., None] * 0.8
    srgb = np.power(np.clip(c, 0, 1), 1 / 2.2)
    save_rgb((srgb * 255).astype(np.uint8), 'paving-color.jpg', 86)
    edge_bevel = np.clip(jd / 6.0, 0, 1)
    hgt = edge_bevel * 0.6 + 0.04 * grain + 0.06 * blotch * 0.2
    save_rgb(normal_from_height(hgt, 2.2), 'paving-normal.jpg', 90)


if __name__ == '__main__':
    which = sys.argv[1:] or ['leaf', 'bark']
    if 'leaf' in which:
        build_leaf_atlas()
    if 'bark' in which:
        build_bark()
    if 'paving' in which:
        build_paving()
