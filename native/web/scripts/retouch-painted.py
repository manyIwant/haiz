# Remove the baked comparison-slider chrome (divider, handle, labels) from the painted-lab noon renders.
import sys
from PIL import Image
import numpy as np
S = sys.argv[1]; OUT = sys.argv[2]

def dilate(m, r):
    out = m.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dx * dx + dy * dy <= r * r:
                out |= np.roll(np.roll(m, dy, 0), dx, 1)
    return out

def fill(a, M, search=(150, 100), step=2):
    H, W, _ = a.shape
    band = dilate(M, 6) & ~M
    ys, xs = np.where(M | band)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    big = dilate(M, 8)
    best = None
    for dy in range(-search[1], search[1] + 1, step):
        for dx in range(-search[0], search[0] + 1, step):
            sy0, sy1, sx0, sx1 = y0 + dy, y1 + dy, x0 + dx, x1 + dx
            if sy0 < 0 or sx0 < 0 or sy1 > H or sx1 > W: continue
            if big[sy0:sy1, sx0:sx1][(M | band)[y0:y1, x0:x1]].any(): continue
            src = a[sy0:sy1, sx0:sx1]
            tgt = a[y0:y1, x0:x1]
            b = band[y0:y1, x0:x1]
            c = ((src[b] - tgt[b]) ** 2).sum()
            # prefer sources with similar texture energy inside (avoid flat patches in busy areas)
            if best is None or c < best[0]: best = (c, dy, dx)
    _, dy, dx = best
    src = a[y0 + dy:y1 + dy, x0 + dx:x1 + dx].copy()
    tgt = a[y0:y1, x0:x1].copy()
    m = M[y0:y1, x0:x1]
    # Poisson-style seam correction: harmonic interpolation of the boundary difference
    corr = np.where(m[..., None], 0.0, tgt - src)
    for _ in range(3000):
        avg = (np.roll(corr, 1, 0) + np.roll(corr, -1, 0) + np.roll(corr, 1, 1) + np.roll(corr, -1, 1)) / 4
        corr = np.where(m[..., None], avg, tgt - src)
    out = a.copy()
    region = out[y0:y1, x0:x1]
    region[m] = (src + corr)[m]
    return out, (dx, dy)

for n in ['lanshu', 'library']:
    im = np.asarray(Image.open(f'{S}/{n}-noon-split.jpg').convert('RGB')).astype(float)
    a = im.copy()
    # 1. the 2px divider: interpolate across from its clean neighbours
    a[:, 639] = im[:, 638] * 2 / 3 + im[:, 641] / 3
    a[:, 640] = im[:, 638] / 3 + im[:, 641] * 2 / 3
    H, W, _ = a.shape
    yy, xx = np.mgrid[0:H, 0:W]
    disc = (xx - 640.5) ** 2 + (yy - 360) ** 2 <= 21 ** 2
    left = (xx >= 607) & (xx <= 636) & (yy >= 385) & (yy <= 402)
    right = (xx >= 645) & (xx <= 677) & (yy >= 385) & (yy <= 402)
    a, o1 = fill(a, disc)
    a, o2 = fill(a, left, step=1, search=(80, 60))
    a, o3 = fill(a, right, step=1, search=(80, 60))
    print(n, 'disc from', o1, 'labels from', o2, o3)
    # 3. the two halves were rendered with different shaders: remove the tonal step at the seam by
    #    meeting in the middle — a per-row offset, smoothed vertically, faded out over a wide band
    L = a[:, 614:622].mean(1); R = a[:, 658:666].mean(1)
    d = L - R
    k = np.exp(-0.5 * (np.arange(-75, 76) / 25.0) ** 2); k /= k.sum()
    dp = np.pad(d, ((75, 75), (0, 0)), mode='edge')
    ds = np.stack([np.convolve(dp[:, c], k, mode='valid') for c in range(3)], 1)
    Wb = 260
    for x in range(639 - Wb, 641 + Wb):
        if x < 639: w = -0.5 * (1 - (639 - x) / Wb)
        else: w = 0.5 * (1 - (x - 640) / Wb)
        w = w * (1 - 0) # linear ramp
        a[:, x] += ds * w
    # the 2px divider itself, re-interpolated after the shift
    a[:, 639] = a[:, 638] * 2 / 3 + a[:, 641] / 3
    a[:, 640] = a[:, 638] / 3 + a[:, 641] * 2 / 3
    # JPEG chroma subsampling smeared the white line's colour ~4px each side: keep the luminance
    # texture there, re-interpolate only the chroma from clean columns
    Y = 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]
    Cb = a[..., 2] - Y; Cr = a[..., 0] - Y
    xa, xb = 621, 658  # the two 16px JPEG MCU columns that hold the line
    for x in range(xa + 1, xb):
        t = (x - xa) / (xb - xa)
        Cb[:, x] = Cb[:, xa] * (1 - t) + Cb[:, xb] * t
        Cr[:, x] = Cr[:, xa] * (1 - t) + Cr[:, xb] * t
    # luma ringing from the line's 8px blocks shows as faint column stripes in flat areas (sky):
    # extract the column-constant part of the high-pass residual by averaging it down each column
    # (real texture averages out; ringing does not), then subtract it
    def blur1(v, sig, axis):
        r = int(sig * 3); k = np.exp(-0.5 * (np.arange(-r, r + 1) / sig) ** 2); k /= k.sum()
        pad = [(0, 0)] * v.ndim; pad[axis] = (r, r)
        vp = np.pad(v, pad, mode='edge')
        return np.apply_along_axis(lambda m: np.convolve(m, k, mode='valid'), axis, vp)
    band = Y[:, 600:680]
    hp = band - blur1(band, 5.0, 1)
    ring = blur1(hp, 30.0, 0)
    wcol = np.zeros(80); wcol[28:52] = 1.0  # columns 628..651
    Y[:, 600:680] = band - ring * wcol[None, :]
    R_ = Y + Cr; B_ = Cb + Y; G_ = (Y - 0.299 * R_ - 0.114 * B_) / 0.587
    a = np.stack([R_, G_, B_], 2)
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(f'{OUT}/{n}-noon.jpg', quality=90, optimize=True, progressive=True)
