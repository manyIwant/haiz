"""Procedural, tileable surface textures for the world of 《春天没有收件人》.

No photographs or third-party texture libraries: every map is synthesised here from
periodic noise, so it tiles without seams and can be regenerated bit-for-bit.

    python3 world/textures.py            -> assets/tex/*.png

Conventions
  <name>_col.png   albedo, sRGB
  <name>_rgh.png   roughness, linear grey
  <name>_nrm.png   tangent-space normal (OpenGL, +Y up)
Physical size of one tile is noted next to each generator; the Blender build script
uses the same numbers for its UV scale (TILE dict at the bottom).
"""
import pathlib
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = pathlib.Path(__file__).resolve().parent.parent / "assets" / "tex"
OUT.mkdir(parents=True, exist_ok=True)
FONT_SERIF = "/usr/share/fonts/opentype/noto/NotoSerifCJK-Regular.ttc"
FONT_SANS = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"


# ----------------------------------------------------------------- periodic noise
def fbm(n, beta=2.0, seed=0, lo=1.0, hi=None, aniso=(1.0, 1.0)):
    """Tileable fractal noise by spectral synthesis. beta: spectral slope (2 = brownian)."""
    rng = np.random.default_rng(seed)
    fx = np.fft.fftfreq(n)[None, :] * n / aniso[0]
    fy = np.fft.fftfreq(n)[:, None] * n / aniso[1]
    f = np.sqrt(fx * fx + fy * fy)
    f[0, 0] = 1
    amp = f ** (-beta / 2)
    amp[f < lo] = 0
    if hi:
        amp *= np.exp(-(f / hi) ** 2)
    ph = rng.standard_normal((n, n)) + 1j * rng.standard_normal((n, n))
    out = np.real(np.fft.ifft2(amp * ph))
    out -= out.mean()
    return out / (out.std() + 1e-9)


def blur(a, sigma):
    """Periodic gaussian blur via FFT."""
    n0, n1 = a.shape[:2]
    fy = np.fft.fftfreq(n0)[:, None]
    fx = np.fft.fftfreq(n1)[None, :]
    g = np.exp(-2 * (np.pi * sigma) ** 2 * (fx * fx + fy * fy))
    if a.ndim == 3:
        return np.stack([np.real(np.fft.ifft2(np.fft.fft2(a[..., i]) * g)) for i in range(a.shape[2])], -1)
    return np.real(np.fft.ifft2(np.fft.fft2(a) * g))


def worley(n, cells, seed=0, jitter=1.0):
    """Tileable Worley noise: returns (F1 distance, F2 distance, cell id) in pixel units."""
    rng = np.random.default_rng(seed)
    pts = (np.arange(cells)[:, None, None] * 0 + 0.0)
    jit = rng.random((cells, cells, 2)) * jitter + (1 - jitter) / 2
    cid = rng.random((cells, cells))
    cs = n / cells
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    gx, gy = (xx // cs).astype(int), (yy // cs).astype(int)
    f1 = np.full((n, n), 1e9, np.float32)
    f2 = np.full((n, n), 1e9, np.float32)
    idv = np.zeros((n, n), np.float32)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            cx, cy = gx + dx, gy + dy
            wx, wy = cx % cells, cy % cells
            px = (cx + jit[wy, wx, 0]) * cs
            py = (cy + jit[wy, wx, 1]) * cs
            d = np.hypot(xx - px, yy - py)
            closer = d < f1
            f2 = np.where(closer, f1, np.minimum(f2, d))
            idv = np.where(closer, cid[wy, wx], idv)
            f1 = np.where(closer, d, f1)
    del pts
    return f1, f2, idv


def norm01(a):
    a = a - a.min()
    return a / (a.max() + 1e-9)


def normal_from_height(h, strength):
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5 * strength
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5 * strength
    nz = np.ones_like(h)
    # image rows go down; OpenGL normal maps have +Y up
    v = np.stack([-dx, dy, nz], -1)
    v /= np.linalg.norm(v, axis=-1, keepdims=True)
    return v * 0.5 + 0.5


def lin2srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def save(name, arr, srgb=False):
    a = np.asarray(arr, np.float64)
    if srgb:
        a = lin2srgb(a)
    a = np.clip(a * 255 + 0.5, 0, 255).astype(np.uint8)
    Image.fromarray(a).save(OUT / f"{name}.png", optimize=True)
    print("  ", name, a.shape)


def rgb(*c):
    """sRGB 0..255 triple -> linear float."""
    c = np.array(c, np.float64) / 255
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def tint(base, var, *layers):
    """base colour (linear) modulated by a scalar field."""
    return base[None, None, :] * var[..., None]


# ------------------------------------------------------------------- materials
def plaster(n=2048):
    """Interior whitewash, tile 2 m. Old lime paint: soft mottling, faint water marks."""
    m = fbm(n, 2.4, 1) * 0.05 + fbm(n, 1.2, 2, lo=40) * 0.018
    stains = np.clip(fbm(n, 3.2, 3) - 1.2, 0, None) * 0.10
    col = rgb(229, 226, 214)[None, None, :] * (1 + m - stains)[..., None]
    yel = np.clip(fbm(n, 3.0, 4), 0, None) * 0.025
    col[..., 2] *= 1 - yel
    save("plaster_col", col, True)
    h = fbm(n, 1.6, 5, lo=20) * 0.6 + fbm(n, 2.6, 6) * 0.4
    save("plaster_nrm", normal_from_height(h, 0.9))
    save("plaster_rgh", 0.88 + fbm(n, 2, 7) * 0.04)


def paint_green(n=2048):
    """墙裙: glossy pale-green oil paint on the lower 1.2 m of classroom walls, tile 2 m."""
    m = fbm(n, 2.6, 11) * 0.035
    col = rgb(150, 182, 160)[None, None, :] * (1 + m)[..., None]
    # scuffs: short dark horizontal smudges from chair backs and shoes
    sc = fbm(n, 1.5, 12, aniso=(0.15, 1.0))
    scuff = np.clip(sc - 2.1, 0, None) * 0.5
    col *= (1 - scuff)[..., None]
    # paint chips revealing white undercoat
    f1, f2, _ = worley(n, 90, 13, 1.0)
    chips = ((f2 - f1) < 2.2) & (fbm(n, 2.0, 14) > 1.6)
    chips = blur(chips.astype(float), 0.8)
    col = col * (1 - chips[..., None]) + rgb(226, 224, 214)[None, None, :] * chips[..., None]
    save("paintgreen_col", col, True)
    h = fbm(n, 2.2, 15) * 0.3 - chips * 1.0
    save("paintgreen_nrm", normal_from_height(h, 1.5))
    save("paintgreen_rgh", np.clip(0.32 + fbm(n, 2, 16) * 0.05 + scuff * 0.4 + chips * 0.4, 0, 1))


def terrazzo(n=2048):
    """水磨石 floor, tile = one 1 m panel with a brass divider strip at its border."""
    base = rgb(176, 170, 156)[None, None, :] * (1 + fbm(n, 2.4, 21)[..., None] * 0.04)
    col = base.copy()
    rough = np.full((n, n), 0.42)
    palette = [rgb(236, 232, 222), rgb(40, 40, 38), rgb(120, 70, 50), rgb(88, 110, 92), rgb(150, 146, 136), rgb(205, 196, 176)]
    for k, (cells, thr, seed) in enumerate([(70, 0.30, 22), (160, 0.30, 23), (360, 0.26, 24)]):
        f1, f2, cid = worley(n, cells, seed, 1.0)
        cs = n / cells
        chip = (f2 - f1) > (1.0 - thr) * cs * 0.62
        # chip colour by cell id
        idx = (cid * len(palette) * 7).astype(int) % len(palette)
        pc = np.stack(palette)[idx]
        keep = chip & (cid > 0.45)
        col = np.where(keep[..., None], pc * (0.92 + 0.16 * cid[..., None]), col)
        rough = np.where(keep, 0.30, rough)
    # wear: duller paths, faint dirt
    wear = norm01(blur(fbm(n, 2.2, 25), 6))
    col *= (1 - 0.06 * wear)[..., None]
    rough = np.clip(rough + wear * 0.18 + fbm(n, 1.4, 26) * 0.03, 0.15, 0.9)
    # brass divider strip on the tile border (3 mm @ 1 m/2048 px ~ 6 px)
    yy, xx = np.mgrid[0:n, 0:n]
    e = np.minimum(np.minimum(xx, n - 1 - xx), np.minimum(yy, n - 1 - yy))
    strip = np.clip(1 - (e - 3.0) / 1.5, 0, 1)
    col = col * (1 - strip[..., None]) + rgb(150, 122, 74)[None, None, :] * strip[..., None]
    rough = rough * (1 - strip) + 0.35 * strip
    save("terrazzo_col", col, True)
    save("terrazzo_rgh", rough)
    save("terrazzo_nrm", normal_from_height(fbm(n, 2.0, 27) * 0.2 - strip * 0.5, 1.0))


def wood_desk(n=2048):
    """Varnished plywood desk top, tile 1.2 m, grain along U."""
    yy, xx = np.mgrid[0:n, 0:n] / n
    warp = fbm(n, 2.8, 31, aniso=(0.25, 1.0)) * 0.035 + fbm(n, 3.2, 32) * 0.01
    v = yy + warp
    rings = np.sin((v * 17 + fbm(n, 2.5, 33, aniso=(0.1, 1)) * 1.4 + fbm(n, 3.5, 38) * 0.8) * 2 * np.pi)
    fine = fbm(n, 1.1, 34, lo=60, aniso=(0.06, 1.0))
    g = 0.5 + 0.5 * rings
    g = g ** 4
    col = rgb(206, 166, 112)[None, None, :] * (1 - 0.30 * g - 0.10 * fine)[..., None]
    col *= (1 + fbm(n, 2.2, 35)[..., None] * 0.05)
    # scratches: thin random lines
    img = Image.new("L", (n, n), 0)
    d = ImageDraw.Draw(img)
    rng = np.random.default_rng(36)
    for _ in range(700):
        x0, y0 = rng.random(2) * n
        ang = rng.normal(0, 0.6)
        ln = rng.random() * n * 0.08
        x1, y1 = x0 + np.cos(ang) * ln, y0 + np.sin(ang) * ln
        d.line([x0, y0, x1, y1], fill=int(40 + rng.random() * 90), width=1)
    # ink dots and a few blue ballpoint marks
    for _ in range(60):
        x0, y0 = rng.random(2) * n
        r = rng.random() * 3 + 1
        d.ellipse([x0 - r, y0 - r, x0 + r, y0 + r], fill=255)
    scr = np.asarray(img, np.float64) / 255
    col *= (1 - 0.25 * scr)[..., None]
    save("wood_col", col, True)
    save("wood_rgh", np.clip(0.38 + 0.08 * g + 0.25 * scr + fbm(n, 2, 37) * 0.04, 0, 1))
    save("wood_nrm", normal_from_height(g * 0.15 - scr * 0.8 + fine * 0.05, 1.2))


def metal_paint(n=1024):
    """Generic enamel-painted steel (tinted per object in the shader), tile 1 m."""
    m = fbm(n, 2.5, 41) * 0.03
    wear = np.clip(fbm(n, 1.8, 42) - 1.7, 0, None)
    col = np.full((n, n, 3), 0.8) * (1 + m)[..., None]
    col = col * (1 - wear[..., None] * 0.6)
    save("metal_col", col, True)
    save("metal_rgh", np.clip(0.42 + wear * 0.5 + fbm(n, 2, 43) * 0.04, 0, 1))
    save("metal_nrm", normal_from_height(fbm(n, 2.4, 44) * 0.1 - wear * 0.4, 1.0))


def chalkboard(w=4096, h=1152):
    """Blackboard 4.0 x 1.2 m, single image. Erased lessons still faintly there."""
    base = rgb(38, 58, 48)
    n = 4096
    big = fbm(n, 2.6, 51)[:h, :w]
    col = base[None, None, :] * (1 + big[..., None] * 0.08)
    # ghost of erased writing
    img = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(img)
    fnt = ImageFont.truetype(FONT_SERIF, 150)
    fnt2 = ImageFont.truetype(FONT_SANS, 92)
    d.text((240, 160), "失物招领", font=fnt, fill=200)
    d.text((300, 520), "一  二  三  四", font=fnt2, fill=150)
    d.text((1900, 230), "春  分", font=fnt, fill=170)
    d.text((2050, 640), "17:42", font=fnt2, fill=150)
    d.text((3000, 180), "值日", font=fnt2, fill=170)
    d.text((3000, 330), "窗户", font=fnt2, fill=140)
    ghost = np.asarray(img.filter(ImageFilter.GaussianBlur(9)), np.float64) / 255
    # eraser swipes: large soft horizontal arcs of chalk dust
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float64)
    sw = np.zeros((h, w))
    rng = np.random.default_rng(52)
    for _ in range(26):
        cx, cy = rng.random() * w, rng.random() * h
        a, b = 300 + rng.random() * 700, 60 + rng.random() * 120
        k = np.exp(-(((xx - cx) / a) ** 2 + ((yy - cy) / b) ** 2))
        sw += k * (0.3 + rng.random() * 0.6)
    sw *= 0.75 + 0.25 * norm01(fbm(n, 1.6, 55, aniso=(0.1, 1.0))[:h, :w])
    dust = np.clip(ghost * 0.22 + sw * 0.07 + np.clip(fbm(n, 1.4, 53)[:h, :w] - 1.4, 0, None) * 0.05, 0, 1)
    # dust accumulates near the chalk ledge
    dust += np.clip((yy / h - 0.82) * 1.2, 0, None) * 0.15 * (0.7 + 0.3 * fbm(n, 2, 54)[:h, :w])
    chalk = rgb(225, 228, 222)
    col = col * (1 - dust[..., None]) + chalk[None, None, :] * dust[..., None]
    save("chalkboard_col", col, True)
    save("chalkboard_rgh", np.clip(0.78 - dust * 0.1, 0, 1))


def concrete(n=2048):
    """Weathered cast concrete, tile 2 m (platform, embankment, plinth)."""
    m = fbm(n, 2.2, 61) * 0.07 + fbm(n, 1.3, 62, lo=30) * 0.03
    f1, _, _ = worley(n, 420, 63)
    pores = np.clip(1 - f1 / 2.0, 0, 1) * (fbm(n, 1.0, 64) > 0.8)
    stain = np.clip(fbm(n, 3.0, 65) - 0.6, 0, None) * 0.12
    streak = np.clip(fbm(n, 2.0, 66, aniso=(1.0, 0.05)) - 0.8, 0, None) * 0.08
    v = 1 + m - stain - streak - pores * 0.25
    col = rgb(158, 156, 148)[None, None, :] * v[..., None]
    col[..., 1] *= 1 + np.clip(fbm(n, 3, 67) - 1.5, 0, None) * 0.05  # faint moss tint
    save("concrete_col", col, True)
    save("concrete_rgh", np.clip(0.86 + fbm(n, 2, 68) * 0.04 - stain * 0.5, 0, 1))
    save("concrete_nrm", normal_from_height(fbm(n, 1.5, 69) * 0.4 - pores * 0.6, 1.2))


def facade(n=2048):
    """Exterior lime render with vertical rain streaks, tile 3 m."""
    m = fbm(n, 2.4, 71) * 0.05
    streak = fbm(n, 1.8, 72, aniso=(1.0, 0.04))
    streak = np.clip(streak - 0.3, 0, None) * 0.07
    grime = np.clip(fbm(n, 3.2, 73) - 0.5, 0, None) * 0.08
    col = rgb(222, 216, 200)[None, None, :] * (1 + m - streak - grime)[..., None]
    save("facade_col", col, True)
    save("facade_rgh", np.clip(0.9 + fbm(n, 2, 74) * 0.03, 0, 1))
    save("facade_nrm", normal_from_height(fbm(n, 1.4, 75, lo=30) * 0.5 + fbm(n, 2.6, 76) * 0.4, 1.2))


def stone(n=2048):
    """Granite block plinth, tile 2 m (4 x 3 blocks with joints)."""
    yy, xx = np.mgrid[0:n, 0:n] / n
    rows = 4
    r = (yy * rows).astype(int)
    xs = (xx * 3 + (r % 2) * 0.5) % 1.0
    ys = (yy * rows) % 1.0
    jx = np.minimum(xs, 1 - xs) * 3 * n / n
    jy = np.minimum(ys, 1 - ys) / rows
    joint = np.clip(1 - np.minimum(jx * n / 3, jy * n) / 6.0, 0, 1)
    blockid = ((xx * 3 + (r % 2) * 0.5).astype(int) * 7 + r * 13) % 11 / 11
    speck = fbm(n, 0.8, 81, lo=200)
    v = 0.92 + 0.10 * blockid + speck * 0.05 + fbm(n, 2.4, 82) * 0.05
    col = rgb(120, 118, 112)[None, None, :] * v[..., None]
    col = col * (1 - joint[..., None] * 0.55)
    wet = np.clip(1 - yy * 1.3, 0, 1) ** 2  # tile assumed bottom = waterline side
    col *= (1 - 0.0 * wet[..., None])
    save("stone_col", col, True)
    save("stone_rgh", np.clip(0.7 + speck * 0.05 + joint * 0.2, 0, 1))
    save("stone_nrm", normal_from_height(-joint * 1.5 + fbm(n, 1.6, 83) * 0.25, 1.5))


def corrugated(n=1024):
    """Painted corrugated steel roofing, tile 1 m, corrugation along V (76 mm pitch)."""
    yy, xx = np.mgrid[0:n, 0:n] / n
    h = np.sin(xx * 2 * np.pi * 13)
    rust = np.clip(fbm(n, 2.0, 91, aniso=(1, 0.2)) - 1.0, 0, None)
    col = rgb(168, 176, 172)[None, None, :] * (1 + fbm(n, 2.5, 92)[..., None] * 0.04)
    col = col * (1 - rust[..., None] * 0.35) + rgb(120, 70, 40)[None, None, :] * rust[..., None] * 0.3
    save("corr_col", col, True)
    save("corr_rgh", np.clip(0.55 + rust * 0.3, 0, 1))
    save("corr_nrm", normal_from_height(h * 3.0, 3.0))


def fabric(n=1024):
    """Faded blue cotton curtain, tile 0.5 m."""
    yy, xx = np.mgrid[0:n, 0:n]
    weave = (np.sin(xx * np.pi / 2.0) * np.sin(yy * np.pi / 2.0)) * 0.5 + 0.5
    fade = norm01(blur(fbm(n, 2.0, 101), 20))
    col = rgb(92, 120, 150)[None, None, :] * (0.9 + 0.1 * weave + 0.15 * fade)[..., None]
    save("fabric_col", col, True)
    save("fabric_nrm", normal_from_height(weave * 0.5 + fbm(n, 2.0, 102) * 0.2, 1.0))


def grass(n=2048):
    """Bank soil and worn grass seen from a distance, tile 4 m."""
    a = fbm(n, 2.3, 111)
    b = fbm(n, 1.2, 112, lo=60)
    g = norm01(blur(a, 4))
    soil = rgb(104, 92, 70)
    turf = rgb(86, 100, 58)
    dry = rgb(150, 138, 96)
    mix = np.clip(g * 1.4 - 0.2, 0, 1)
    col = soil[None, None, :] * (1 - mix[..., None]) + turf[None, None, :] * mix[..., None]
    drym = np.clip(fbm(n, 2.6, 113) - 0.3, 0, 1) * 0.6
    col = col * (1 - drym[..., None]) + dry[None, None, :] * drym[..., None]
    col *= (1 + b[..., None] * 0.08)
    save("grass_col", col, True)
    save("grass_nrm", normal_from_height(b * 0.6 + a * 0.2, 1.5))


def water_normal(n=1024):
    """Tileable water height field (directional chop), used as a scrolling normal map."""
    a = fbm(n, 3.4, 121, lo=3, aniso=(1.0, 0.55))
    b = fbm(n, 2.8, 122, lo=10, hi=200)
    h = a * 0.7 + b * 0.3
    save("water_nrm", normal_from_height(h, 6.0))
    c = fbm(n, 3.0, 123, lo=6)
    save("water2_nrm", normal_from_height(c, 5.0))


def track(n=2048):
    """Rubber running-track surface, tile 1 m (red EPDM granules)."""
    f1, _, cid = worley(n, 700, 131)
    gran = 0.85 + 0.3 * cid
    col = rgb(156, 64, 48)[None, None, :] * gran[..., None] * (1 + fbm(n, 2.2, 132)[..., None] * 0.06)
    save("track_col", col, True)
    save("track_nrm", normal_from_height(-f1 / 3.0, 0.6))


def paper(n=1024):
    """Letter paper / envelope, tile 0.3 m."""
    col = rgb(236, 228, 210)[None, None, :] * (1 + fbm(n, 1.4, 141, lo=20)[..., None] * 0.02 + fbm(n, 2.8, 142)[..., None] * 0.02)
    save("paper_col", col, True)


def signboard(w=2400, h=640):
    """Station nameboard: the name has been taken by the wind. Only the frame of the
    layout remains: a blank white band, pinyin line empty, neighbour-station arrows."""
    img = Image.new("RGB", (w, h), (238, 238, 232))
    d = ImageDraw.Draw(img)
    # navy band at the bottom with neighbour stations
    d.rectangle([0, int(h * 0.72), w, h], fill=(24, 52, 98))
    fnt = ImageFont.truetype(FONT_SANS, 64)
    d.text((70, int(h * 0.76)), "◀  窗", font=fnt, fill=(235, 238, 240))
    d.text((w - 330, int(h * 0.76)), "门前  ▶", font=fnt, fill=(235, 238, 240))
    a = np.asarray(img, np.float64) / 255
    # the place where the name was: slightly cleaner paint, faint ghost outline of glyphs
    ghost = Image.new("L", (w, h), 0)
    gd = ImageDraw.Draw(ghost)
    gfont = ImageFont.truetype(FONT_SANS, 300)
    gd.text((w // 2 - 330, 40), "　　", font=gfont, fill=255)
    g = np.asarray(ghost.filter(ImageFilter.GaussianBlur(6)), np.float64) / 255
    dirt = fbm(2048, 2.2, 151)[:h, :min(w, 2048)]
    dirt = np.pad(dirt, ((0, 0), (0, max(0, w - 2048))), mode="wrap")
    streak = np.pad(fbm(2048, 1.8, 152, aniso=(1.0, 0.05))[:h, :min(w, 2048)], ((0, 0), (0, max(0, w - 2048))), mode="wrap")
    a = a * (1 - 0.03 * dirt[..., None] - np.clip(streak - 0.8, 0, None)[..., None] * 0.06)
    a = a * (1 - g[..., None] * 0.0)
    lin = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
    save("sign_col", lin, True)


def timetable(w=900, h=1200):
    """课程表 pinned on the classroom wall."""
    img = Image.new("RGB", (w, h), (240, 234, 218))
    d = ImageDraw.Draw(img)
    fnt = ImageFont.truetype(FONT_SANS, 56)
    small = ImageFont.truetype(FONT_SANS, 38)
    d.text((w // 2 - 112, 50), "课程表", font=fnt, fill=(40, 40, 40))
    cols = ["", "一", "二", "三", "四", "五"]
    subj = ["语文", "数学", "英语", "物理", "历史", "地理", "音乐", "美术"]
    x0, y0, cw, rh = 40, 160, (w - 80) / 6, 120
    rng = np.random.default_rng(161)
    for i in range(9):
        d.line([x0, y0 + i * rh, w - 40, y0 + i * rh], fill=(90, 90, 90), width=2)
    for j in range(7):
        d.line([x0 + j * cw, y0, x0 + j * cw, y0 + 8 * rh], fill=(90, 90, 90), width=2)
    for j, c in enumerate(cols):
        d.text((x0 + j * cw + cw / 2 - 18, y0 + 30), c, font=small, fill=(30, 30, 30))
    for i in range(1, 8):
        d.text((x0 + 30, y0 + i * rh + 34), str(i), font=small, fill=(30, 30, 30))
        for j in range(1, 6):
            d.text((x0 + j * cw + 18, y0 + i * rh + 34), subj[rng.integers(len(subj))], font=small, fill=(50, 50, 60))
    a = np.asarray(img.filter(ImageFilter.GaussianBlur(0.6)), np.float64) / 255
    lin = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
    save("timetable_col", lin, True)


def clockface(n=1024):
    img = Image.new("RGB", (n, n), (238, 236, 228))
    d = ImageDraw.Draw(img)
    c = n / 2
    d.ellipse([8, 8, n - 8, n - 8], outline=(30, 30, 30), width=22)
    fnt = ImageFont.truetype(FONT_SANS, 92)
    for i in range(60):
        a = i / 60 * 2 * np.pi
        r0 = c * (0.80 if i % 5 == 0 else 0.86)
        r1 = c * 0.92
        d.line([c + np.sin(a) * r0, c - np.cos(a) * r0, c + np.sin(a) * r1, c - np.cos(a) * r1], fill=(25, 25, 25), width=14 if i % 5 == 0 else 5)
    for k in range(1, 13):
        a = k / 12 * 2 * np.pi
        tx, ty = c + np.sin(a) * c * 0.66, c - np.cos(a) * c * 0.66
        s = str(k)
        bb = d.textbbox((0, 0), s, font=fnt)
        d.text((tx - (bb[2] - bb[0]) / 2, ty - (bb[3] - bb[1]) / 2 - bb[1]), s, font=fnt, fill=(25, 25, 25))
    a = np.asarray(img, np.float64) / 255
    lin = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
    save("clock_col", lin, True)


# Physical tile sizes in metres (used for UV scale in world/build_world.py).
TILE = {"plaster": 2.0, "paintgreen": 2.0, "terrazzo": 1.0, "wood": 1.2, "metal": 1.0,
        "concrete": 2.0, "facade": 3.0, "stone": 2.0, "corr": 1.0, "fabric": 0.5,
        "grass": 4.0, "track": 1.0, "paper": 0.3}

if __name__ == "__main__":
    import sys
    only = set(sys.argv[1:])
    for fn in [plaster, paint_green, terrazzo, wood_desk, metal_paint, chalkboard, concrete, facade,
               stone, corrugated, fabric, grass, water_normal, track, paper, signboard, timetable, clockface]:
        if only and fn.__name__ not in only:
            continue
        print(fn.__name__)
        fn()
