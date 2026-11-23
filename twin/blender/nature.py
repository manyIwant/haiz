"""Natural forms for the twin: sculpted rocks (signed distance fields -> marching cubes), branch
skeletons -> tapered tubes, leaf rosettes, royal palms, Norfolk Island pines.

Everything here returns kit.Geo objects in twin coordinates (metres, z up) so that builders can
tag and place them.  Randomness is always seeded: rebuilding gives identical geometry.
"""
from __future__ import annotations
import math
import numpy as np
from kit import Geo


# ======================================================================================
# rocks
# ======================================================================================

def _noise3(shape, rng, octaves=4, base=6, stretch=(1.0, 1.0, 1.0)):
    from scipy.ndimage import zoom
    out = np.zeros(shape, np.float32)
    amp = 1.0
    for o in range(octaves):
        n = [max(2, int(base * (2 ** o) / s)) for s in stretch]
        small = rng.standard_normal(n).astype(np.float32)
        z = zoom(small, [shape[i] / n[i] for i in range(3)], order=3)
        out += amp * z[:shape[0], :shape[1], :shape[2]]
        amp *= 0.5
    return out / 1.9


def sdf_rock(blobs, bounds, res, seed, noise=0.2, ridges=0.0, tunnels=(), k=0.35, floor_z=0.0, mat='stone.rock.boulder'):
    """Smooth union of ellipsoids + fBm noise (+ vertical ridged noise) minus tubes, cut flat at
    floor_z, polygonised with marching cubes into a shared-vertex Geo.
    blobs: (cx, cy, cz, rx, ry, rz); tunnels: (cx, cy, cz, ax, ay, az, r)."""
    from skimage import measure
    rng = np.random.default_rng(seed)
    X0, X1, Y0, Y1, Z0, Z1 = bounds
    nx, ny, nz = int((X1 - X0) / res), int((Y1 - Y0) / res), int((Z1 - Z0) / res)
    xs = np.linspace(X0, X1, nx); ys = np.linspace(Y0, Y1, ny); zs = np.linspace(Z0, Z1, nz)
    X, Y, Z = np.meshgrid(xs, ys, zs, indexing='ij')
    d = np.full(X.shape, 10.0, np.float32)
    for cx, cy, cz, rx, ry, rz in blobs:
        e = (np.sqrt(((X - cx) / rx) ** 2 + ((Y - cy) / ry) ** 2 + ((Z - cz) / rz) ** 2) - 1.0) * min(rx, ry, rz)
        h = np.clip(0.5 + 0.5 * (d - e) / k, 0, 1)
        d = d * (1 - h) + e * h - k * h * (1 - h)
    d = d + noise * _noise3(X.shape, rng)
    if ridges:
        # vertical flutes and sharp crests typical of water-worn limestone
        rn = _noise3(X.shape, rng, octaves=3, base=5, stretch=(1.0, 1.0, 3.5))
        d = d + ridges * (np.abs(rn) - 0.35)
    for cx, cy, cz, ax, ay, az, r in tunnels:
        a = np.array([ax, ay, az], float); a /= np.linalg.norm(a)
        P = np.stack([X - cx, Y - cy, Z - cz], -1)
        t = np.clip(P @ a, -3.0, 3.0)
        Q = P - t[..., None] * a
        wob = 1.0 + 0.25 * _noise3(X.shape, rng, octaves=2, base=4)
        tube = np.linalg.norm(Q, axis=-1) - r * wob
        d = np.maximum(d, -tube)
    d = np.maximum(d, -(Z - floor_z))
    return mesh_field(d, (X0, Y0, Z0), res, floor_z, mat)


def mesh_field(d, origin, res, floor_z, mat):
    """Polygonise a signed-distance grid (negative inside, axis-aligned, spacing res, first sample at
    origin) with marching cubes; the flat underside at floor_z is dropped."""
    from skimage import measure
    X0, Y0, Z0 = origin
    verts, faces, normals, _ = measure.marching_cubes(d, level=0.0, spacing=(res, res, res), gradient_direction='ascent')
    verts = verts + np.array([X0, Y0, Z0])
    # make the winding agree with the outward SDF gradient (one global check)
    gx, gy, gz = np.gradient(d, res)
    idx = np.clip(((verts - [X0, Y0, Z0]) / res).round().astype(int), 0, np.array(d.shape) - 1)
    grad = np.stack([gx[tuple(idx.T)], gy[tuple(idx.T)], gz[tuple(idx.T)]], -1)
    fn = np.cross(verts[faces[:, 1]] - verts[faces[:, 0]], verts[faces[:, 2]] - verts[faces[:, 0]])
    if np.sum(np.einsum('ij,ij->i', fn, grad[faces[:, 0]])) < 0:
        faces = faces[:, ::-1]
    # drop the flat underside (never seen; sits on the ground)
    keep = ~(np.all(verts[faces][:, :, 2] < floor_z + res * 0.6, axis=1))
    faces = faces[keep]
    g = Geo()
    g.add_indexed(mat, verts, faces)
    return g


def taihu_rock(seed=1923, res=0.05):
    """The forecourt's Taihu stone: about 7.6 x 3.0 x 2.9 m.  Bulky high east end (+x) standing on
    'legs' with a large hollow beneath, long low west end ending in a raised head; deeply fluted
    and perforated (jiaoxuelou-1600, campus_taihushi).  Holes and crags are procedural."""
    blobs = [(2.2, 0.0, 1.55, 1.55, 1.2, 1.15), (1.1, 0.25, 2.05, 1.25, 0.95, 0.85), (2.9, -0.3, 2.25, 0.85, 0.7, 0.6),
             (0.2, -0.2, 1.25, 1.35, 1.1, 0.95), (-1.0, 0.1, 1.0, 1.35, 0.95, 0.75), (-2.2, -0.1, 1.05, 1.05, 0.8, 0.62),
             (-3.15, 0.0, 1.45, 0.75, 0.55, 0.5), (-3.65, 0.15, 1.95, 0.5, 0.4, 0.45), (-3.95, 0.25, 2.25, 0.32, 0.3, 0.3),
             (1.6, -0.5, 2.55, 0.7, 0.55, 0.55), (0.0, 0.5, 0.45, 2.4, 1.0, 0.45), (-1.8, -0.4, 1.75, 0.6, 0.5, 0.55),
             (2.75, 0.45, 0.45, 0.45, 0.45, 0.6), (1.55, -0.45, 0.4, 0.4, 0.4, 0.55)]
    tunnels = [(2.15, 0.0, 0.55, 0.15, 1.0, 0.0, 0.55),       # hollow under the high end ('legs')
               (0.6, 0.0, 0.5, 0.1, 1.0, 0.2, 0.32)]
    rng = np.random.default_rng(seed + 7)
    for _ in range(26):
        c = (rng.uniform(-3.6, 3.2), rng.uniform(-0.6, 0.6), rng.uniform(0.6, 2.6))
        a = rng.standard_normal(3); a[2] *= 0.5
        tunnels.append((*c, *a, rng.uniform(0.12, 0.36)))
    return sdf_rock(blobs, (-4.5, 4.2, -1.9, 1.9, -0.1, 3.3), res, seed, noise=0.24, ridges=0.2, tunnels=tunnels,
                    k=0.28, mat='stone.limestone.taihu')


def boulder(seed, size=(1.5, 1.2, 2.1), res=0.05, mat='stone.rock.boulder', lean=(0.0, 0.0), foot=1.1, k=0.25, noise=0.05):
    """Rounded upright field boulder centred on the origin, base at z = 0.  foot scales the width of
    the lowest lobe (above 1: spreading base; below 1: bulging body on a narrower foot).  For small
    stones pass a finer res and proportionally smaller k (blend radius) and noise."""
    sx, sy, sz = size
    rng = np.random.default_rng(seed)
    blobs = [(0.0, 0.0, sz * 0.42, sx * 0.5, sy * 0.5, sz * 0.45),
             (lean[0] * sz, lean[1] * sz, sz * 0.7, sx * 0.4, sy * 0.42, sz * 0.32),
             (rng.uniform(-0.1, 0.1) * sx, rng.uniform(-0.1, 0.1) * sy, sz * 0.2, sx * 0.5 * foot, sy * 0.45 * foot, sz * 0.25)]
    m = max(sx, sy) * 0.8
    return sdf_rock(blobs, (-m, m, -m, m, -0.05, sz * 1.15), res, seed, noise=noise, ridges=0.0, k=k, mat=mat)


# ======================================================================================
# branch skeletons -> tubes
# ======================================================================================

def _catmull(pts, step):
    """Densify a polyline of (x, y, z, r) with a centripetal-ish Catmull-Rom spline."""
    P = np.asarray(pts, float)
    if len(P) < 3:
        n = max(1, int(np.linalg.norm(P[-1, :3] - P[0, :3]) / step))
        return np.array([P[0] + (P[-1] - P[0]) * t for t in np.linspace(0, 1, n + 1)])
    ext = np.vstack([2 * P[0] - P[1], P, 2 * P[-1] - P[-2]])
    out = [P[0]]
    for i in range(1, len(ext) - 2):
        p0, p1, p2, p3 = ext[i - 1], ext[i], ext[i + 1], ext[i + 2]
        n = max(1, int(np.linalg.norm(p2[:3] - p1[:3]) / step))
        for t in np.linspace(0, 1, n + 1)[1:]:
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    return np.array(out)


def tube(nodes, sides=None, mat='bark.generic', flare=None, bark_noise=0.0, seed=0, cap=True):
    """Tapered tube along nodes (N, 4: x y z r) with parallel-transport frames.
    Returns (verts, faces) as numpy / list for Geo.add_indexed."""
    N = np.asarray(nodes, float)
    if len(N) < 2:
        return None, None
    r_max = N[:, 3].max()
    k = sides or (14 if r_max > 0.5 else 10 if r_max > 0.2 else 7 if r_max > 0.07 else 5 if r_max > 0.03 else 4)
    rng = np.random.default_rng(seed)
    T = np.gradient(N[:, :3], axis=0)
    T /= np.linalg.norm(T, axis=1, keepdims=True) + 1e-12
    up = np.array([0.0, 0.0, 1.0]) if abs(T[0, 2]) < 0.9 else np.array([1.0, 0.0, 0.0])
    U = np.cross(T[0], up); U /= np.linalg.norm(U)
    th = np.linspace(0, 2 * math.pi, k, endpoint=False)
    verts = []
    phase = rng.uniform(0, 2 * math.pi)
    s_along = 0.0
    for i in range(len(N)):
        if i > 0:
            s_along += np.linalg.norm(N[i, :3] - N[i - 1, :3])
            # parallel transport of U
            b = np.cross(T[i - 1], T[i])
            if np.linalg.norm(b) > 1e-8:
                b /= np.linalg.norm(b)
                ang = math.acos(max(-1.0, min(1.0, float(np.dot(T[i - 1], T[i])))))
                U = U * math.cos(ang) + np.cross(b, U) * math.sin(ang) + b * np.dot(b, U) * (1 - math.cos(ang))
            U = U - T[i] * np.dot(U, T[i]); U /= np.linalg.norm(U) + 1e-12
        V = np.cross(T[i], U)
        r = N[i, 3] * np.ones(k)
        if bark_noise:
            r *= 1.0 + bark_noise * (np.sin(5 * th + phase + s_along * 0.7) * 0.5 + rng.uniform(-0.5, 0.5, k))
        if flare is not None:
            r *= flare(N[i], th)
        ring = N[i, :3] + (np.cos(th)[:, None] * U + np.sin(th)[:, None] * V) * r[:, None]
        verts.append(ring)
    verts = np.concatenate(verts)
    faces = []
    for i in range(len(N) - 1):
        a0, b0 = i * k, (i + 1) * k
        for j in range(k):
            j1 = (j + 1) % k
            faces.append((a0 + j, a0 + j1, b0 + j1, b0 + j))
    if cap:
        last = (len(N) - 1) * k
        faces.append(tuple(last + j for j in range(k)))
    return verts, faces


# ======================================================================================
# leaves
# ======================================================================================

def _rot_to(n):
    """Rotation matrix taking +z to unit vector n."""
    n = n / np.linalg.norm(n)
    z = np.array([0.0, 0.0, 1.0])
    v = np.cross(z, n); c = float(np.dot(z, n))
    if np.linalg.norm(v) < 1e-9:
        return np.eye(3) if c > 0 else np.diag([1.0, -1.0, -1.0])
    vx = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    return np.eye(3) + vx + vx @ vx * (1 / (1 + c))


def rosette_template(n_leaves=7, length=0.24, width=0.13, tilt_deg=28.0, seed=0):
    """Whorl of obovate leaves radiating from a twig tip (Terminalia catappa: leaves 15-25 cm,
    crowded at branch ends).  Each leaf is a 6-vertex blade bent once along its length."""
    rng = np.random.default_rng(seed)
    V, F = [], []
    for i in range(n_leaves):
        a = 2 * math.pi * i / n_leaves + rng.uniform(-0.25, 0.25)
        L = length * rng.uniform(0.8, 1.15); W = width * rng.uniform(0.85, 1.1)
        tilt = math.radians(tilt_deg + rng.uniform(-10, 10))
        # leaf in local (u along blade, v across, w up): obovate outline, widest at 65 %
        prof = [(0.0, 0.0), (0.30 * L, 0.32 * W), (0.65 * L, 0.5 * W), (L, 0.0), (0.65 * L, -0.5 * W), (0.30 * L, -0.32 * W)]
        base = len(V)
        for u, v in prof:
            droop = 0.18 * (u / L) ** 2 * L          # tip droops a little
            w = u * math.sin(tilt) - droop
            uu = u * math.cos(tilt)
            V.append((uu * math.cos(a) - v * math.sin(a), uu * math.sin(a) + v * math.cos(a), w))
        F.append((base, base + 1, base + 2, base + 3))
        F.append((base, base + 3, base + 4, base + 5))
    return np.array(V), F


def place_rosettes(points, normals, template, scale_range=(0.8, 1.2), seed=0, mats=None):
    """Instance the rosette template at points with up-vectors normals.  Returns (verts, faces, fmat)."""
    rng = np.random.default_rng(seed)
    TV, TF = template
    nv = len(TV)
    allV = np.empty((len(points) * nv, 3))
    faces, fmat = [], []
    mats = mats or [('leaf.generic', 1.0)]
    names = [m for m, _ in mats]; w = np.array([p for _, p in mats], float); w /= w.sum()
    for i, (p, n) in enumerate(zip(points, normals)):
        R = _rot_to(np.asarray(n, float))
        a = rng.uniform(0, 2 * math.pi)
        Rz = np.array([[math.cos(a), -math.sin(a), 0], [math.sin(a), math.cos(a), 0], [0, 0, 1]])
        s = rng.uniform(*scale_range)
        allV[i * nv:(i + 1) * nv] = (TV * s) @ (R @ Rz).T + p
        m = names[rng.choice(len(names), p=w)]
        for f in TF:
            faces.append(tuple(i * nv + j for j in f))
            fmat.append(m)
    return allV, faces, fmat


# ======================================================================================
# broadleaf tree from an authored skeleton + procedural growth inside a crown envelope
# ======================================================================================

class Envelope:
    """Crown volume: an XY polygon, a domed top and a flat bottom."""

    def __init__(self, poly, z_bottom, z_top_centre, z_top_edge, centre=None):
        from shapely.geometry import Polygon
        self.poly = Polygon(poly)
        self.zb, self.zc, self.ze = z_bottom, z_top_centre, z_top_edge
        c = self.poly.centroid
        self.c = np.array(centre if centre else (c.x, c.y))
        self.R = max(np.hypot(x - self.c[0], y - self.c[1]) for x, y in self.poly.exterior.coords)

    def z_top(self, x, y):
        d = min(1.0, np.hypot(x - self.c[0], y - self.c[1]) / self.R)
        return self.zc - (self.zc - self.ze) * d * d

    def inside(self, p, margin=0.0):
        from shapely.geometry import Point
        if p[2] > self.z_top(p[0], p[1]) - margin:
            return False
        q = Point(p[0], p[1])
        return self.poly.contains(q) and (margin <= 0 or self.poly.exterior.distance(q) > margin)

    def reach(self, p, d, max_len):
        """Distance one can travel from p along unit d before leaving the envelope."""
        step = 0.4
        t = 0.0
        while t < max_len:
            q = p + d * (t + step)
            if not self.inside(q):
                return t
            t += step
        return max_len


class BroadleafTree:
    """Grows secondary branches, twigs and leaf rosettes on authored primary limbs.

    habit: 'tiered' (Terminalia catappa: horizontal tiers, upturned twig ends, rosettes at the
    tips) or 'rounded' (generic broadleaf)."""

    def __init__(self, limbs, envelope: Envelope, seed=1, habit='tiered', leaf_mats=None, bark='bark.generic',
                 spacing=1.2, twig_spacing=0.55, rosette_step=0.38, leaf_len=0.24, leaf_w=0.13, n_leaves=7,
                 min_spawn_z=2.6, sec_max=8.0, wiggle=1.0):
        self.limbs = limbs
        self.env = envelope
        self.rng = np.random.default_rng(seed)
        self.seed = seed
        self.habit = habit
        self.leaf_mats = leaf_mats or [('leaf.generic', 1.0)]
        self.bark = bark
        self.spacing, self.twig_spacing, self.rosette_step = spacing, twig_spacing, rosette_step
        self.leaf_len, self.leaf_w, self.n_leaves = leaf_len, leaf_w, n_leaves
        self.min_spawn_z = min_spawn_z
        self.sec_max, self.wiggle = sec_max, wiggle     # longest secondary limb (m); scale of the sideways bow
        self.branches = []           # list of (nodes (N,4), level)
        self.leaf_pts, self.leaf_up = [], []

    # -- growth helpers ------------------------------------------------------------------
    def _dir(self, az, el):
        return np.array([math.cos(el) * math.cos(az), math.cos(el) * math.sin(az), math.sin(el)])

    def _grow(self, p0, d, L, r0, level, upturn=0.35, sag=0.0):
        """Polyline from p0 along d for length L, tip curving up (Terminalia) and optional sag."""
        n = max(3, int(L / 0.45) + 1)
        pts = []
        horiz = np.array([d[0], d[1], 0.0])
        hn = np.linalg.norm(horiz)
        horiz = horiz / hn if hn > 1e-6 else np.array([1.0, 0.0, 0.0])
        side = np.cross([0, 0, 1.0], horiz)
        wig = self.rng.uniform(-0.15, 0.15) * self.wiggle
        w2, w3 = self.rng.uniform(-0.06, 0.06, 2) * self.wiggle
        for i in range(n):
            t = i / (n - 1)
            p = p0 + d * L * t
            p = p + np.array([0, 0, 1.0]) * (upturn * L * t ** 2.2 - sag * L * math.sin(math.pi * t) + w3 * L * math.sin(2 * math.pi * t))
            p = p + side * (wig * L * math.sin(math.pi * t) + w2 * L * math.sin(3 * math.pi * t))
            r = r0 * (1.0 - 0.8 * t) + 0.006
            pts.append([p[0], p[1], p[2], r])
        P = np.array(pts)
        # clip where it leaves the envelope (keep at least the first two nodes)
        for i in range(2, len(P)):
            if not self.env.inside(P[i, :3]):
                P = P[:i]
                break
        return P

    def _leaves_along(self, P, start=0.5, step=None):
        step = step or self.rosette_step
        seg = np.linalg.norm(np.diff(P[:, :3], axis=0), axis=1)
        s = np.concatenate([[0], np.cumsum(seg)])
        L = s[-1]
        if L < 1e-3:
            return
        for t in np.arange(L * start, L + 1e-6, step):
            p = np.array([np.interp(t, s, P[:, k]) for k in range(3)])
            up = np.array([self.rng.normal(0, 0.25), self.rng.normal(0, 0.25), 1.0])
            jitter = self.rng.normal(0, 0.06, 3)
            self.leaf_pts.append(p + jitter)
            self.leaf_up.append(up)
        # tip rosette slightly larger, facing up/out
        tip = P[-1, :3]
        dvec = P[-1, :3] - P[-2, :3]
        self.leaf_pts.append(tip)
        self.leaf_up.append(np.array([dvec[0] * 0.3, dvec[1] * 0.3, 1.0]))

    def _twigs(self, P, level):
        """Short tertiary shoots in the branch's horizontal plane, alternating sides."""
        seg = np.linalg.norm(np.diff(P[:, :3], axis=0), axis=1)
        s = np.concatenate([[0], np.cumsum(seg)])
        L = s[-1]
        if L < 0.8:
            self._leaves_along(P, start=0.3)
            return
        sign = 1
        for t in np.arange(L * 0.25, L - 0.2, self.twig_spacing * self.rng.uniform(0.8, 1.25)):
            p = np.array([np.interp(t, s, P[:, k]) for k in range(4)])
            i = min(len(P) - 2, int(np.searchsorted(s, t)) - 1 if np.searchsorted(s, t) > 0 else 0)
            d = P[i + 1, :3] - P[i, :3]
            d /= np.linalg.norm(d) + 1e-9
            az = math.atan2(d[1], d[0]) + sign * self.rng.uniform(0.7, 1.3)
            el = self.rng.uniform(-0.05, 0.35) if self.habit == 'tiered' else self.rng.uniform(0.1, 0.7)
            dd = self._dir(az, el)
            Lt = self.rng.uniform(0.4, 1.1) * (1.0 - 0.4 * t / L)
            Q = self._grow(p[:3], dd, Lt, max(0.012, p[3] * 0.45), level + 1, upturn=0.45 if self.habit == 'tiered' else 0.15)
            if len(Q) >= 2:
                self.branches.append((Q, level + 1))
                self._leaves_along(Q, start=0.2)
            sign = -sign
        self._leaves_along(P, start=0.7)

    def _secondaries(self, P, level, spacing):
        seg = np.linalg.norm(np.diff(P[:, :3], axis=0), axis=1)
        s = np.concatenate([[0], np.cumsum(seg)])
        L = s[-1]
        sign = 1 if self.rng.random() < 0.5 else -1
        t = spacing * self.rng.uniform(0.6, 1.2)
        while t < L - 0.3:
            p = np.array([np.interp(t, s, P[:, k]) for k in range(4)])
            if p[2] < self.min_spawn_z or p[3] > 0.42:
                t += spacing * 0.7
                continue
            i = max(0, min(len(P) - 2, int(np.searchsorted(s, t)) - 1))
            d = P[i + 1, :3] - P[i, :3]
            d /= np.linalg.norm(d) + 1e-9
            az0 = math.atan2(d[1], d[0])
            if self.habit == 'tiered':
                az = az0 + sign * self.rng.uniform(0.6, 1.6)
                el = self.rng.uniform(0.0, 0.45) if self.rng.random() < 0.75 else self.rng.uniform(0.5, 0.9)
            else:
                az = az0 + sign * self.rng.uniform(0.4, 1.4)
                el = self.rng.uniform(0.25, 0.9)
            dd = self._dir(az, el)
            reach = self.env.reach(p[:3], dd, 9.0)
            if reach > 1.2:
                Lb = min(reach * self.rng.uniform(0.75, 0.98), self.sec_max)
                r0 = max(0.025, min(p[3] * 0.5, 0.025 + 0.016 * Lb))
                Q = self._grow(p[:3], dd, Lb, r0, level + 1, upturn=0.25 if self.habit == 'tiered' else 0.1,
                               sag=0.06 if Lb > 4 else 0.0)
                if len(Q) >= 2:
                    self.branches.append((Q, level + 1))
                    if level + 1 < 2 and Lb > 3.5:
                        self._secondaries(Q, level + 1, spacing * 0.9)
                    self._twigs(Q, level + 1)
            sign = -sign
            t += spacing * self.rng.uniform(0.7, 1.3)

    def fill_gaps(self, cell=1.6, z_levels=None):
        """Reach into empty parts of the envelope from the nearest existing branch node, so that
        the crown outline matches the mapped canopy."""
        from shapely.geometry import Point
        if not self.leaf_pts:
            return
        L = np.array(self.leaf_pts)
        nodes = np.concatenate([b[0] for b in self.branches if b[1] <= 2])
        x0, y0, x1, y1 = self.env.poly.bounds
        from scipy.spatial import cKDTree
        lt = cKDTree(L[:, :2]); nt = cKDTree(nodes[:, :3])
        added = 0
        for x in np.arange(x0 + cell / 2, x1, cell):
            for y in np.arange(y0 + cell / 2, y1, cell):
                if not self.env.poly.contains(Point(x, y)):
                    continue
                if lt.query([x, y])[0] < cell * 0.9:
                    continue
                zt = self.env.z_top(x, y)
                target = np.array([x, y, max(self.env.zb + 1.0, zt - self.rng.uniform(1.0, 2.5))])
                _, j = nt.query(target)
                p = nodes[j]
                d = target - p[:3]
                Ld = np.linalg.norm(d)
                if Ld < 0.5:
                    continue
                d /= Ld
                Q = self._grow(p[:3], d, Ld * 1.05, max(0.02, min(0.08, p[3] * 0.5)), 2, upturn=0.15)
                if len(Q) >= 2:
                    self.branches.append((Q, 2))
                    self._twigs(Q, 2)
                    added += 1
        return added

    def grow(self):
        for limb in self.limbs:
            P = _catmull(limb['pts'], 0.35)
            self.branches.append((P, 0 if limb.get('id') == 'trunk' else 1))
            if limb.get('id') != 'trunk':
                self._secondaries(P, 1, self.spacing)
                self._twigs(P[int(len(P) * 0.6):], 1)
        self.fill_gaps()
        return self

    # -- output ----------------------------------------------------------------------------
    def geo(self, flare=None, bark_noise_trunk=0.06, min_r=0.008):
        g = Geo()
        for i, (P, level) in enumerate(self.branches):
            if P[:, 3].max() < min_r:
                continue
            fl = flare if level == 0 else None
            v, f = tube(P, flare=fl, bark_noise=bark_noise_trunk if P[:, 3].max() > 0.15 else 0.0, seed=self.seed + i,
                        cap=P[:, 3].min() > 0.05)
            if v is not None:
                g.add_indexed(self.bark, v, f)
        leaves = Geo()
        tpl = rosette_template(self.n_leaves, self.leaf_len, self.leaf_w, seed=self.seed)
        V, F, M = place_rosettes(self.leaf_pts, self.leaf_up, tpl, seed=self.seed, mats=self.leaf_mats)
        leaves.add_indexed(M, V, F)
        return g, leaves

    def stats(self):
        return dict(branches=len(self.branches), rosettes=len(self.leaf_pts))


def buttress(base_z, amount=0.55, height=1.1, lobes=5, seed=0):
    """Flare function for the trunk base: lobed buttress roots fading out with height."""
    ph = np.random.default_rng(seed).uniform(0, 2 * math.pi)

    def f(node, th):
        h = max(0.0, node[2] - base_z)
        e = math.exp(-h / height)
        return 1.0 + amount * e * (0.55 + 0.45 * np.maximum(0, np.cos(lobes * th + ph)) ** 2)
    return f


# ======================================================================================
# royal palm (Roystonea regia)
# ======================================================================================

def coconut_palm(x, y, z0, height=11.0, seed=0, lean=(0.08, 0.0), n_fronds=20):
    """Coconut palm (Cocos nucifera): slender ringed grey-brown trunk with a pronounced curving
    lean, no crownshaft, a full crown of long drooping fronds and a cluster of nuts."""
    rng = np.random.default_rng(seed)
    g = Geo()
    H = height
    nodes = []
    for t in np.linspace(0, 1, 20):
        bend = t ** 1.6
        r = 0.2 - 0.05 * t + 0.1 * math.exp(-t * H / 0.4)
        nodes.append([x + lean[0] * H * bend, y + lean[1] * H * bend, z0 + H * t * (1 - 0.5 * (lean[0] ** 2 + lean[1] ** 2)), r])
    nodes = np.array(nodes)
    v, f = tube(nodes, sides=10, bark_noise=0.03, seed=seed)
    g.add_indexed('bark.coconut', v, f)
    apex = nodes[-1, :3] + np.array([0, 0, 0.3])
    for k in range(5):
        a = rng.uniform(0, 2 * math.pi)
        c = apex + np.array([0.25 * math.cos(a), 0.25 * math.sin(a), -0.35])
        v, f = tube(np.array([[*c, 0.11], [*(c + [0, 0, 0.001]), 0.11], [*(c + [0, 0, -0.2]), 0.0]]), sides=8)
        g.add_indexed('palm.coconut.nut', v, f)
    for i in range(n_fronds):
        az = i * 2.39996 + rng.uniform(-0.2, 0.2)
        age = i / n_fronds
        el = math.radians(60 - 95 * age + rng.uniform(-10, 10))
        Lr = rng.uniform(4.0, 5.0)
        dvec = np.array([math.cos(el) * math.cos(az), math.cos(el) * math.sin(az), math.sin(el)])
        pts = np.array([apex + dvec * Lr * t + np.array([0, 0, -1.9 * Lr * 0.35 * t * t]) for t in np.linspace(0, 1, 12)])
        rach = np.hstack([pts, np.linspace(0.05, 0.01, len(pts))[:, None]])
        v, f = tube(rach, sides=4)
        g.add_indexed('leaf.coconut', v, f)
        T = np.gradient(pts, axis=0); T /= np.linalg.norm(T, axis=1, keepdims=True)
        side = np.cross(T, [0, 0, 1.0]); side /= np.linalg.norm(side, axis=1, keepdims=True) + 1e-9
        upv = np.cross(side, T)
        Vs, Fs = [], []
        for j in range(40):
            t = 0.1 + 0.88 * j / 39
            kf = t * (len(pts) - 1); a0 = int(kf); b0 = min(a0 + 1, len(pts) - 1); w = kf - a0
            p = pts[a0] * (1 - w) + pts[b0] * w
            ll = 0.9 * math.sin(math.pi * min(1.0, 0.2 + t)) + 0.15
            for sgn in (1, -1):
                d1 = sgn * side[a0] * 0.8 + T[a0] * 0.45 - upv[a0] * 0.35          # leaflets in one plane, V-drooping
                d1 /= np.linalg.norm(d1)
                q1 = p + d1 * ll * 0.5 + np.array([0, 0, -0.08 * ll]); q2 = p + d1 * ll + np.array([0, 0, -0.3 * ll])
                wv = np.cross(d1, upv[a0]); wv /= np.linalg.norm(wv) + 1e-9
                hw = 0.03
                bi = len(Vs)
                Vs += [p - wv * hw * 0.5, p + wv * hw * 0.5, q1 + wv * hw, q1 - wv * hw, q2]
                Fs += [(bi, bi + 1, bi + 2, bi + 3), (bi + 3, bi + 2, bi + 4)]
        g.add_indexed('leaf.coconut', np.array(Vs), Fs)
    return g


def royal_palm(x, y, z0, height=13.0, seed=0, lean=(0.0, 0.0), white_base=1.2, n_fronds=15):
    """Smooth grey columnar trunk with a mid-height swelling, white-painted base, glossy green
    crownshaft and a crown of arching pinnate fronds with leaflets in several planes."""
    rng = np.random.default_rng(seed)
    g = Geo()
    H = height
    # trunk nodes
    nodes = []
    for t in np.linspace(0, 1, 18):
        z = z0 + H * t
        r = 0.27 - 0.05 * t + 0.035 * math.exp(-((t - 0.5) / 0.22) ** 2) + 0.12 * math.exp(-t * H / 0.5)
        nodes.append([x + lean[0] * t * t * H, y + lean[1] * t * t * H, z, r])
    nodes = np.array(nodes)
    # split at the paint line
    zc = z0 + white_base
    lo = nodes[nodes[:, 2] <= zc]; hi = nodes[nodes[:, 2] >= zc]
    cut = np.array([[np.interp(zc, nodes[:, 2], nodes[:, k]) for k in (0, 1)] + [zc, np.interp(zc, nodes[:, 2], nodes[:, 3])]])
    v, f = tube(np.vstack([lo, cut]), sides=12, cap=False)
    g.add_indexed('paint.white.trunk', v, f)
    v, f = tube(np.vstack([cut, hi]), sides=12, cap=False)
    g.add_indexed('bark.palm', v, f)
    top = nodes[-1, :3]
    # crownshaft
    cs = np.array([[top[0], top[1], top[2] - 0.05, 0.215], [top[0], top[1], top[2] + 1.2, 0.235],
                   [top[0], top[1], top[2] + 2.3, 0.19], [top[0], top[1], top[2] + 2.6, 0.12]])
    v, f = tube(cs, sides=12)
    g.add_indexed('palm.crownshaft', v, f)
    apex = top + np.array([0, 0, 2.5])
    # fronds
    for i in range(n_fronds):
        az = i * 2.39996 + rng.uniform(-0.15, 0.15)          # golden-angle phyllotaxis
        age = i / n_fronds
        el = math.radians(75 - 95 * age + rng.uniform(-8, 8))  # young upright -> old drooping
        Lr = rng.uniform(3.4, 4.2)
        base = apex + np.array([0, 0, -0.1 * age])
        dvec = np.array([math.cos(el) * math.cos(az), math.cos(el) * math.sin(az), math.sin(el)])
        pts = []
        for t in np.linspace(0, 1, 12):
            p = base + dvec * Lr * t + np.array([0, 0, -1.6 * Lr * 0.35 * t * t])
            pts.append(p)
        pts = np.array(pts)
        rach = np.hstack([pts, np.linspace(0.06, 0.012, len(pts))[:, None]])
        v, f = tube(rach, sides=4)
        g.add_indexed('leaf.palm', v, f)
        # leaflets
        T = np.gradient(pts, axis=0); T /= np.linalg.norm(T, axis=1, keepdims=True)
        side = np.cross(T, [0, 0, 1.0]); side /= np.linalg.norm(side, axis=1, keepdims=True) + 1e-9
        upv = np.cross(side, T)
        Vs, Fs = [], []
        n_lf = 44
        for j in range(n_lf):
            t = 0.12 + 0.86 * j / (n_lf - 1)
            k = t * (len(pts) - 1); a = int(k); b = min(a + 1, len(pts) - 1); w = k - a
            p = pts[a] * (1 - w) + pts[b] * w
            Tt = T[a]; S = side[a]; Uu = upv[a]
            ll = 0.95 * math.sin(math.pi * min(1.0, 0.15 + t)) + 0.15
            for sgn in (1, -1):
                plane = rng.choice([0.6, -0.3, 0.15])       # leaflets in several planes (plumose)
                d1 = sgn * S * math.cos(0.5) + Tt * 0.55 + Uu * plane
                d1 /= np.linalg.norm(d1)
                droop = np.array([0, 0, -0.35 * ll])
                q0 = p; q1 = p + d1 * ll * 0.5 + droop * 0.2; q2 = p + d1 * ll + droop
                wv = np.cross(d1, Uu); wv /= np.linalg.norm(wv) + 1e-9
                hw = 0.022
                base_i = len(Vs)
                Vs += [q0 - wv * hw * 0.5, q0 + wv * hw * 0.5, q1 + wv * hw, q1 - wv * hw, q2]
                Fs += [(base_i, base_i + 1, base_i + 2, base_i + 3), (base_i + 3, base_i + 2, base_i + 4)]
        g.add_indexed('leaf.palm', np.array(Vs), Fs)
    return g


# ======================================================================================
# Norfolk Island pine (Araucaria heterophylla)
# ======================================================================================

def araucaria(x, y, z0, height=21.0, seed=0, base_spread=4.2):
    """Straight trunk with whorls of five near-horizontal branches every ~1 m, shortening upwards
    into a narrow cone; each branch carries drooping rope-like branchlets."""
    rng = np.random.default_rng(seed)
    g = Geo()
    tr = np.array([[x, y, z0 + h, 0.32 * (1 - h / height) + 0.04] for h in np.linspace(0, height, 16)])
    v, f = tube(tr, sides=10)
    g.add_indexed('bark.araucaria', v, f)
    z = z0 + 3.0
    k = 0
    Vs, Fs = [], []
    while z < z0 + height - 0.6:
        frac = (z - z0 - 3.0) / (height - 3.0)
        L = base_spread * (1 - frac) ** 0.9 + 0.5
        ph = rng.uniform(0, 2 * math.pi)
        for b in range(5):
            az = ph + b * 2 * math.pi / 5 + rng.uniform(-0.15, 0.15)
            d = np.array([math.cos(az), math.sin(az), 0.08])
            pts = np.array([[x, y, z, 0.07 * (1 - frac) + 0.02]] + [[x + d[0] * L * t, y + d[1] * L * t, z + 0.25 * L * t * t - 0.1 * L * t, 0.05 * (1 - t) * (1 - frac) + 0.012] for t in (0.33, 0.66, 1.0)])
            v, f = tube(pts, sides=5)
            g.add_indexed('bark.araucaria', v, f)
            # branchlets: hanging ropes of foliage on both sides
            side = np.array([-d[1], d[0], 0.0])
            for t in np.linspace(0.1, 1.0, max(4, int(L / 0.17))):
                p = np.array([x + d[0] * L * t, y + d[1] * L * t, z + 0.25 * L * t * t - 0.1 * L * t])
                for sgn, dz in ((1, 0.35), (-1, 0.35), (1, 0.8), (-1, 0.8)):
                    ln = 0.6 * (1.1 - 0.6 * t) * (1 - 0.4 * frac) * rng.uniform(0.8, 1.2)
                    q1 = p + side * sgn * ln * 0.5 + np.array([0, 0, -ln * dz * 0.5]) + d * 0.1
                    q2 = p + side * sgn * ln * 0.8 + np.array([0, 0, -ln * dz]) + d * 0.15
                    w = 0.075
                    up = np.array([0, 0, 1.0])
                    bi = len(Vs)
                    Vs += [p - d * w, p + d * w, q1 + d * w, q1 - d * w, q2]
                    Fs += [(bi, bi + 1, bi + 2, bi + 3), (bi + 3, bi + 2, bi + 4)]
        z += rng.uniform(0.75, 0.95)
        k += 1
    g.add_indexed('leaf.araucaria', np.array(Vs), Fs)
    return g
