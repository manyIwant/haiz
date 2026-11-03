"""HAIZ · 一棵榄仁树 — Blender build of the Terminalia catappa in front of
No.1 Teaching Building, Hainan Middle School (Fucheng campus).

Run with Blender 5.x (or the `bpy` 5.2 wheel from PyPI):

    blender -b --python scripts/lanren/build_tree.py
    # or
    python -c "import bpy, runpy; runpy.run_path('scripts/lanren/build_tree.py', run_name='__main__')"

Outputs (deterministic for a given SEED):
    build/lanren/lanren-tree.blend         editable source scene (not committed)
    build/lanren/tree-raw.glb              bark mesh with COLOR_0 = (AO, flex, youth, 1)
    lanren/assets/rosettes.bin             Float32 x 12 per leaf rosette (see tree.json)
    lanren/assets/tree.json                counts, bounds, observation anchors, provenance

Art direction (see docs/lanren-20261103.md):
  * The scaffold is hand-authored from the reference photograph
    (assets/images/web/lanshu-1600.jpg, 区大伟 摄): a massive trunk that forks
    low, and one long "dragon" limb that runs west almost horizontally, dips
    beside the boulders, then rises again into its own crown. This is an
    artistic reconstruction of a photograph, not a survey.
  * Everything finer follows Terminalia catappa's architecture: sympodial,
    plagiotropic branch tiers (Aubréville's model) — near-horizontal fans
    whose tips turn upward, leaves crowded in rosettes at shoot tips.
  * Axes (Blender): +X = campus east along the facade, +Y = campus north
    (towards the North Gate), +Z = up. The building face sits at Y ~ -11 m.
"""
import json
import math
import os
import random
import struct
import sys

import bpy  # noqa: I001  (bpy must load before bmesh/mathutils)
import bmesh
from mathutils import Vector, Matrix, noise
from mathutils.kdtree import KDTree

SEED = 1923  # the school's founding year; any integer gives a different tree
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
BUILD = os.path.join(ROOT, 'build', 'lanren')
ASSETS = os.path.join(ROOT, 'lanren', 'assets')
os.makedirs(BUILD, exist_ok=True)
os.makedirs(ASSETS, exist_ok=True)
QUICK = '--quick' in sys.argv

rng = random.Random(SEED)
UP = Vector((0, 0, 1))


# --------------------------------------------------------------- geometry utils
def catmull(points, ds):
    """Centripetal-ish Catmull-Rom through control points, resampled every ds."""
    P = [Vector(p) for p in points]
    P = [P[0] + (P[0] - P[1])] + P + [P[-1] + (P[-1] - P[-2])]
    dense = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        n = max(4, int((p2 - p1).length / (ds * 0.25)))
        for k in range(n):
            t = k / n
            t2, t3 = t * t, t * t * t
            dense.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
                                + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    dense.append(P[-2].copy())
    return resample(dense, ds)


def resample(pts, ds):
    out = [pts[0].copy()]
    acc = 0.0
    for a, b in zip(pts, pts[1:]):
        seg = (b - a).length
        while acc + seg >= ds and seg > 1e-9:
            t = (ds - acc) / seg
            a = a.lerp(b, t)
            out.append(a.copy())
            seg = (b - a).length
            acc = 0.0
        acc += seg
    if (out[-1] - pts[-1]).length > ds * 0.3:
        out.append(pts[-1].copy())
    else:
        out[-1] = pts[-1].copy()
    return out


def rot_z(v, ang):
    c, s = math.cos(ang), math.sin(ang)
    return Vector((v.x * c - v.y * s, v.x * s + v.y * c, v.z))


def horiz(v):
    h = Vector((v.x, v.y, 0))
    return h.normalized() if h.length > 1e-6 else Vector((1, 0, 0))


def wobble(pts, amp, freq, seed, fade=1.0):
    """Organic deviation, zero at the branch base."""
    out = []
    L = max(1e-6, len(pts) - 1)
    for i, p in enumerate(pts):
        w = min(1.0, (i / L) / fade) if fade > 0 else 1.0
        n = noise.noise_vector(p * freq + Vector((seed * 3.17, seed * 1.31, seed * 0.77)))
        out.append(p + n * amp * w)
    return out


# --------------------------------------------------------------- branch model
class Branch:
    __slots__ = ('pts', 'rad', 'kind', 'parent', 'depth', 'base_path', 'prof', 'children', 'seed')

    def __init__(self, pts, r0, r1, kind, parent=None, depth=0, base_path=0.0, taper=0.85, prof=None):
        self.pts = pts
        n = len(pts)
        self.rad = [r1 + (r0 - r1) * (1 - i / max(1, n - 1)) ** taper for i in range(n)]
        self.kind = kind
        self.parent = parent
        self.depth = depth
        self.base_path = base_path
        self.prof = prof
        self.children = []
        self.seed = rng.random() * 100

    def length(self):
        return sum((b - a).length for a, b in zip(self.pts, self.pts[1:]))

    def at(self, frac):
        idx = min(len(self.pts) - 1, max(0, int(round(frac * (len(self.pts) - 1)))))
        return idx, self.pts[idx], self.rad[idx]

    def tangent(self, i):
        a = self.pts[max(0, i - 1)]
        b = self.pts[min(len(self.pts) - 1, i + 1)]
        return (b - a).normalized()

    def path_at(self, i):
        return self.base_path + sum((b - a).length for a, b in zip(self.pts[:i], self.pts[1:i + 1]))


branches = []
rosettes = []    # dict(pos, dir, size, flex, depth, path)
fruits = []


def add(b):
    branches.append(b)
    if b.parent:
        b.parent.children.append(b)
    return b


# --------------------------------------------------------------- 1. trunk & scaffold
def trunk_profile(i, n, theta, seed=0.0):
    """Buttressed, fluted cross-section near the ground, fading upward."""
    h = i / max(1, n - 1)
    lobes = (0.20 * math.cos(5 * theta + 0.6) + 0.12 * math.cos(3 * theta + 2.1)
             + 0.08 * math.cos(7 * theta + 4.0) + 0.05 * math.cos(2 * theta + 1.0))
    flare = math.exp(-h * 9.0)
    return 1.0 + lobes * (0.35 + 1.4 * flare) * (1.0 - 0.6 * h) + 0.55 * flare


trunk_pts = catmull([(0.35, -0.05, -0.35), (0.30, -0.02, 0.6), (0.18, 0.05, 1.7),
                     (0.00, 0.10, 2.6), (-0.15, 0.12, 3.1)], 0.10)
trunk_pts = wobble(trunk_pts, 0.05, 0.9, 1)
trunk = add(Branch(trunk_pts, 0.80, 0.60, 'trunk', taper=1.2, prof=trunk_profile))

SCAFFOLD = {
    # name: (control points, base radius, tip radius, crown centre for laterals)
    'dragon': ([(-0.10, 0.10, 2.55), (-1.6, 0.35, 3.05), (-3.6, 0.55, 3.05), (-5.6, 0.80, 2.55),
                (-7.4, 1.00, 2.02), (-8.7, 1.05, 1.92), (-9.8, 0.90, 2.45), (-10.6, 0.70, 3.6),
                (-11.0, 0.55, 5.2), (-11.2, 0.40, 7.1), (-11.7, 0.20, 9.0), (-12.1, 0.0, 10.4)],
               0.50, 0.10, (-10.5, 0.3, 6.0)),
    'west_up': ([(-0.15, 0.0, 2.9), (-1.0, -0.3, 4.6), (-2.6, -0.9, 6.5), (-4.0, -1.4, 8.4),
                 (-5.2, -1.8, 10.2), (-6.0, -2.1, 11.4)], 0.44, 0.06, (-3.0, -0.8, 7.0)),
    'east': ([(0.15, 0.0, 2.6), (1.4, 0.30, 3.7), (3.2, 0.80, 4.9), (5.3, 1.30, 5.7),
              (7.4, 1.70, 6.3), (9.0, 2.00, 6.9)], 0.42, 0.06, (3.0, 0.6, 5.0)),
    'north': ([(0.0, 0.25, 2.55), (0.4, 1.70, 3.7), (0.9, 3.40, 4.8), (1.3, 5.20, 5.5),
               (1.5, 6.40, 6.0)], 0.34, 0.05, (0.5, 2.0, 5.0)),
    'south': ([(0.05, -0.25, 2.7), (0.5, -1.7, 4.3), (1.0, -3.2, 6.1), (1.6, -4.4, 7.3),
               (2.0, -5.2, 8.0)], 0.34, 0.05, (0.6, -2.0, 6.0)),
    'leader': ([(-0.05, 0.05, 2.8), (0.25, 0.0, 5.3), (0.10, 0.30, 8.2), (0.50, 0.05, 11.2),
                (0.35, 0.20, 13.6)], 0.36, 0.05, (0.2, 0.1, 9.0)),
}
scaffolds = {}
for name, (cps, r0, r1, centre) in SCAFFOLD.items():
    pts = catmull(cps, 0.10)
    pts = wobble(pts, 0.10 if name != 'dragon' else 0.13, 0.55, len(scaffolds) + 3, fade=0.15)
    b = add(Branch(pts, r0, r1, 'scaffold', parent=trunk, depth=1,
                   base_path=trunk.length() * 0.95, taper=0.6))
    b.seed = len(scaffolds)
    scaffolds[name] = (b, Vector(centre))

# a rising limb from the dragon's back, seen in the photograph mid-span
db, _ = scaffolds['dragon']
i_mid, p_mid, r_mid = db.at(0.30)
riser_pts = catmull([p_mid, p_mid + Vector((-0.3, -0.25, 1.6)), p_mid + Vector((-1.0, -0.6, 3.6)),
                     p_mid + Vector((-1.6, -0.9, 5.4)), p_mid + Vector((-2.0, -1.0, 6.6))], 0.10)
riser_pts = wobble(riser_pts, 0.08, 0.6, 21, fade=0.2)
riser = add(Branch(riser_pts, r_mid * 0.7, 0.05, 'scaffold', parent=db, depth=2,
                   base_path=db.path_at(i_mid), taper=0.8))
scaffolds['riser'] = (riser, p_mid + Vector((-1.4, -0.6, 4.5)))

# surface roots: half-buried, running out under the paving
for k in range(7):
    ang = k / 7 * 2 * math.pi + rng.uniform(-0.25, 0.25)
    d = Vector((math.cos(ang), math.sin(ang), 0))
    L = rng.uniform(1.6, 3.2)
    p0 = Vector((0.33, -0.04, 0.25)) + d * 0.45
    cps = [p0, p0 + d * L * 0.35 + Vector((0, 0, -0.18)),
           p0 + d * L * 0.7 + Vector((0, 0, -0.26)), p0 + d * L + Vector((0, 0, -0.40))]
    pts = wobble(catmull(cps, 0.10), 0.07, 1.4, 40 + k, fade=0.2)
    add(Branch(pts, rng.uniform(0.17, 0.26), 0.03, 'root', parent=trunk, depth=1, taper=0.7))


# --------------------------------------------------------------- 2. sympodial tiers
tip_grid = {}


def grid_key(p, cell):
    return (int(math.floor(p.x / cell)), int(math.floor(p.y / cell)), int(math.floor(p.z / cell)))


def crowded(p, cell, rad, layer):
    k = grid_key(p, cell)
    g = tip_grid.setdefault(layer, {})
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            for dz in (-1, 0, 1):
                for q in g.get((k[0] + dx, k[1] + dy, k[2] + dz), ()):
                    if (q - p).length < rad:
                        return True
    return False


def mark(p, cell, layer):
    tip_grid.setdefault(layer, {}).setdefault(grid_key(p, cell), []).append(p.copy())


CROWN_TOP = 14.6


def lateral_path(p0, hdir, L, elev, droop, upturn, bend, seed):
    """A plagiotropic branch: out, slightly sagging, tip turning up."""
    side = rot_z(hdir, math.pi / 2)
    n = max(3, int(L / 0.22))
    pts = []
    for i in range(n + 1):
        s = L * i / n
        u = s / L
        rise = math.sin(elev) * s - droop * s * s / L + upturn * max(0.0, u - 0.62) ** 2 * L
        p = p0 + hdir * (math.cos(elev) * s) + side * (bend * s * s / L) + UP * rise
        p.z = min(p.z, CROWN_TOP - 0.3 * rng.random())
        pts.append(p)
    return wobble(pts, 0.05 * L / 3, 0.9, seed, fade=0.3)


def add_rosette(pos, direction, size, owner, idx):
    if crowded(pos, 0.3, 0.185, 'ros'):
        return False
    mark(pos, 0.3, 'ros')
    rosettes.append(dict(pos=pos.copy(), dir=direction.normalized(), size=size,
                         path=owner.path_at(idx), depth=owner.depth, branch=owner))
    return True


def sympodial_twigs(parent, idx, level):
    """Terminalia short-shoot units: a rosette, then 2-4 shoots fanning out."""
    p = parent.pts[idx]
    d = parent.tangent(idx)
    h = horiz(d)
    add_rosette(p + UP * 0.02, d + UP * 0.6, rng.uniform(0.85, 1.15), parent, idx)
    if level <= 0:
        return
    k = rng.choice((3, 3, 4, 4, 5))
    base_ang = rng.uniform(0, 2 * math.pi)
    for j in range(k):
        ang = base_ang + j * 2 * math.pi / k + rng.uniform(-0.35, 0.35)
        hd = (h * 1.6 + rot_z(Vector((1, 0, 0)), ang)).normalized()
        hd = horiz(hd)
        L = rng.uniform(0.28, 0.55) * (1.0 if level == 2 else 0.85)
        tip = p + hd * L + UP * rng.uniform(0.02, 0.12)
        if crowded(tip, 0.3, 0.165, 'ros'):
            continue
        pts = [p.copy(), p.lerp(tip, 0.5) + UP * 0.03, tip]
        tw = add(Branch(pts, 0.011 + 0.003 * level, 0.006, 'twig', parent=parent, depth=parent.depth + 1,
                        base_path=parent.path_at(idx), taper=1.0))
        sympodial_twigs(tw, len(tw.pts) - 1, level - 1)


def grow_tertiaries(sec):
    L = sec.length()
    s = rng.uniform(0.35, 0.6)
    side = 1 if rng.random() < 0.5 else -1
    n = len(sec.pts)
    while s < L - 0.25:
        idx = min(n - 1, int(s / L * (n - 1)))
        p = sec.pts[idx]
        d = horiz(sec.tangent(idx))
        ang = side * rng.uniform(0.55, 1.15)
        hd = rot_z(d, ang)
        tl = rng.uniform(0.6, 1.5) * (1.0 - 0.45 * s / L)
        tip = p + hd * tl
        if not crowded(tip, 0.6, 0.34, 'ter'):
            mark(tip, 0.6, 'ter')
            pts = lateral_path(p, hd, tl, math.radians(rng.uniform(4, 16)), 0.04, 0.10,
                               rng.uniform(-0.1, 0.1), sec.seed + s)
            r0 = min(sec.rad[idx] * 0.7, 0.018 + 0.012 * tl)
            ter = add(Branch(pts, r0, 0.009, 'tertiary', parent=sec, depth=sec.depth + 1,
                             base_path=sec.path_at(idx)))
            # short shoots along the tertiary, then the sympodial fan at its tip
            for j in range(2, len(ter.pts) - 1, 3):
                if rng.random() < 0.5:
                    add_rosette(ter.pts[j] + UP * 0.02, ter.tangent(j) + UP * 0.8,
                                rng.uniform(0.7, 0.95), ter, j)
            sympodial_twigs(ter, len(ter.pts) - 1, 2 if rng.random() < 0.75 else 1)
        side = -side
        s += rng.uniform(0.26, 0.5)
    sympodial_twigs(sec, n - 1, 2)


def grow_secondaries(name, sc, centre, start, end, spacing, len_range):
    L = sc.length()
    n = len(sc.pts)
    s = start * L
    side = 1
    count = 0
    while s < end * L:
        idx = min(n - 1, int(s / L * (n - 1)))
        p = sc.pts[idx]
        out = horiz(p - centre) if (p - centre).length > 0.6 else horiz(sc.tangent(idx))
        t = horiz(sc.tangent(idx))
        placed = False
        for attempt in range(8):
            # alternate sides of the limb, bias outward from the crown centre
            ang = side * rng.uniform(0.6, 1.4)
            hd = (rot_z(t, ang) * 0.55 + out * 0.75 + Vector((rng.uniform(-.3, .3), rng.uniform(-.3, .3), 0))).normalized()
            hd = horiz(hd)
            # lower tiers reach further: the pagoda silhouette
            height_f = max(0.0, min(1.0, (p.z - 2.0) / 11.0))
            sl = rng.uniform(*len_range) * (1.25 - 0.6 * height_f)
            tip = p + hd * sl
            if tip.z > CROWN_TOP:
                continue
            if crowded(tip, 1.2, 0.78, 'sec'):
                continue
            mark(tip, 1.2, 'sec')
            elev = math.radians(rng.uniform(6, 26) * (1.2 - height_f * 0.5))
            pts = lateral_path(p, hd, sl, elev, rng.uniform(0.08, 0.22), rng.uniform(0.15, 0.4),
                               rng.uniform(-0.25, 0.25), sc.seed * 7 + s)
            r0 = min(sc.rad[idx] * 0.62, 0.035 + 0.022 * sl)
            sec = add(Branch(pts, r0, 0.012, 'secondary', parent=sc, depth=sc.depth + 1,
                             base_path=sc.path_at(idx)))
            grow_tertiaries(sec)
            placed = True
            count += 1
            break
        side = -side
        s += spacing * rng.uniform(0.7, 1.3) * (1.0 if placed else 0.5)
    return count


plan = {
    'dragon': (0.12, 0.72, 0.62, (2.4, 4.2)),
    'west_up': (0.22, 1.0, 0.58, (2.0, 4.0)),
    'east': (0.18, 1.0, 0.55, (2.2, 4.2)),
    'north': (0.22, 1.0, 0.58, (2.0, 3.8)),
    'south': (0.22, 1.0, 0.58, (2.0, 3.6)),
    'leader': (0.25, 1.0, 0.62, (1.8, 3.6)),
    'riser': (0.22, 1.0, 0.58, (1.8, 3.4)),
}
# the dragon's own crown at its rising end
plan_dragon_crown = (0.70, 1.0, 0.55, (2.0, 3.8))
for name, (start, end, spacing, lr) in plan.items():
    sc, centre = scaffolds[name]
    c = grow_secondaries(name, sc, centre, start, end, spacing, lr)
    print('secondaries', name, c)
sc, _ = scaffolds['dragon']
print('secondaries dragon-crown', grow_secondaries('dragon2', sc, Vector((-11.2, 0.4, 7.0)), *plan_dragon_crown))
for name in plan:
    sc, _ = scaffolds[name]
    sympodial_twigs(sc, len(sc.pts) - 1, 2)

# fruits: green drupes near a portion of rosettes (shown Jul-Oct in the runtime)
for r in rosettes:
    if rng.random() < 0.05:
        for _ in range(rng.randint(1, 3)):
            off = Vector((rng.uniform(-.12, .12), rng.uniform(-.12, .12), rng.uniform(-.16, -.05)))
            fruits.append((r['pos'] + off, rng.random()))

print('branches', len(branches), 'rosettes', len(rosettes), 'fruits', len(fruits))


# --------------------------------------------------------------- 3. per-point flex
def flex_of(b, i):
    path = b.path_at(i)
    r = b.rad[i]
    f = max(0.0, (path - 2.8) / 13.0) ** 1.35 * (1.0 - min(1.0, r / 0.32)) ** 1.5
    return max(0.0, min(1.0, f))


# --------------------------------------------------------------- 4. mesh
BARK_TILE = 0.85  # metres per texture repeat along the branch


def build_mesh():
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new('UVMap')
    col = bm.verts.layers.float_color.new('Col')
    for b in branches:
        n = len(b.pts)
        if n < 2:
            continue
        r_base = b.rad[0]
        if b.kind == 'trunk':
            sides = 40
        elif b.kind in ('scaffold', 'root'):
            sides = max(10, min(28, int(r_base * 70)))
        elif b.kind == 'secondary':
            sides = 8 if r_base > 0.04 else 6
        elif b.kind == 'tertiary':
            sides = 5
        else:
            sides = 3
        rep_u = max(1, round(2 * math.pi * r_base / BARK_TILE)) if b.kind != 'twig' else 1
        # parallel transport frames
        T = [b.tangent(i) for i in range(n)]
        N0 = T[0].orthogonal().normalized()
        frames = []
        Nn = N0
        for i in range(n):
            if i > 0:
                axis = T[i - 1].cross(T[i])
                if axis.length > 1e-6:
                    ang = T[i - 1].angle(T[i])
                    Nn = (Matrix.Rotation(ang, 3, axis.normalized()) @ Nn).normalized()
            Bv = T[i].cross(Nn).normalized()
            frames.append((Nn.copy(), Bv))
        rings = []
        v_acc = 0.0
        vs = []
        youth = {'trunk': 0.0, 'root': 0.0, 'scaffold': 0.05, 'secondary': 0.35, 'tertiary': 0.7, 'twig': 1.0}[b.kind]
        for i in range(n):
            if i > 0:
                v_acc += (b.pts[i] - b.pts[i - 1]).length
            vs.append(v_acc / BARK_TILE)
            Nn, Bv = frames[i]
            r = b.rad[i]
            # branch collar where a child leaves its parent
            if b.parent is not None and b.kind not in ('root',):
                r *= 1.0 + 0.35 * math.exp(-i / 1.5)
            ring = []
            fx = flex_of(b, i)
            for j in range(sides):
                th = 2 * math.pi * j / sides
                k = 1.0
                if b.prof:
                    k = b.prof(i, n, th)
                off = (Nn * math.cos(th) + Bv * math.sin(th)) * r * k
                p = b.pts[i] + off
                if r > 0.06:   # burls & bark relief on old wood
                    p += off.normalized() * r * 0.09 * noise.noise(p * 1.7 + Vector((b.seed, 0, 0)))
                v = bm.verts.new(p)
                v[col] = (1.0, fx, youth, 1.0)
                ring.append(v)
            rings.append(ring)
        for i in range(n - 1):
            a, c = rings[i], rings[i + 1]
            for j in range(sides):
                j2 = (j + 1) % sides
                f = bm.faces.new((a[j], a[j2], c[j2], c[j]))
                f.smooth = True
                u0 = rep_u * j / sides
                u1 = rep_u * (j + 1) / sides
                for loop, uv in zip(f.loops, ((u0, vs[i]), (u1, vs[i]), (u1, vs[i + 1]), (u0, vs[i + 1]))):
                    loop[uv_layer].uv = uv
        # tip cap
        last = rings[-1]
        tipv = bm.verts.new(b.pts[-1] + T[-1] * b.rad[-1] * 0.8)
        tipv[col] = (1.0, flex_of(b, n - 1), youth, 1.0)
        for j in range(sides):
            f = bm.faces.new((last[j], last[(j + 1) % sides], tipv))
            f.smooth = True
            for loop in f.loops:
                loop[uv_layer].uv = (0.5 * rep_u, vs[-1] + 0.05)
    me = bpy.data.meshes.new('lanren_bark')
    bm.to_mesh(me)
    bm.free()
    return me


# --------------------------------------------------------------- 5. scene + bake
def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.unit_settings.system = 'METRIC'
    return sc


scene = reset_scene()
me = build_mesh()
bark = bpy.data.objects.new('LanrenBark', me)
scene.collection.objects.link(bark)
print('bark verts', len(me.vertices), 'tris', sum(len(p.vertices) - 2 for p in me.polygons))

# bark material (Cycles preview / glTF) — the web runtime uses its own shader
mat = bpy.data.materials.new('Bark')
mat.use_nodes = True
nt = mat.node_tree
bsdf = nt.nodes.get('Principled BSDF')
img = bpy.data.images.load(os.path.join(ASSETS, 'bark-color.jpg'))
tex = nt.nodes.new('ShaderNodeTexImage')
tex.image = img
nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
bsdf.inputs['Roughness'].default_value = 0.88
me.materials.append(mat)

# occluders for the AO bake: ground + rosette discs (approximate foliage)
bm = bmesh.new()
bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=40)
gme = bpy.data.meshes.new('ground')
bm.to_mesh(gme)
bm.free()
ground = bpy.data.objects.new('BakeGround', gme)
scene.collection.objects.link(ground)

bm = bmesh.new()
for r in rosettes:
    m = Matrix.Translation(r['pos'] + UP * 0.03)
    bmesh.ops.create_circle(bm, cap_ends=True, segments=7, radius=0.24 * r['size'], matrix=m)
fme = bpy.data.meshes.new('foliage_proxy')
bm.to_mesh(fme)
bm.free()
foliage = bpy.data.objects.new('BakeFoliage', fme)
scene.collection.objects.link(foliage)


# --------------------------------------------------------------- 5b. stones
# Landscape boulders read from the photograph: a tall standing stone in front
# of the dragon limb's lowest point, a lower companion and a flat seat stone,
# plus the raised bed around the main trunk. Set dressing, not survey.
def make_stone(name, loc, scale, seed, sharp=0.5):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=5, radius=1.0)
    off = Vector((seed * 1.7, seed * 0.3, seed * 2.9))
    for v in bm.verts:
        p = v.co.copy()
        n = p.normalized()
        d = 0.0
        amp = 0.28
        f = 1.1
        for o in range(5):
            d += amp * noise.noise(p * f + off)
            amp *= 0.5
            f *= 2.1
        # weathered limestone: rounded masses with a few sharp solution grooves
        groove = abs(noise.noise(p * 2.3 + off * 2.0))
        d -= sharp * 0.10 * math.exp(-groove * 9.0)
        v.co = n * (1.0 + d)
        v.co.x *= scale[0]
        v.co.y *= scale[1]
        v.co.z *= scale[2]
        v.co += Vector(loc)
    # flatten the bottom into the ground
    for v in bm.verts:
        if v.co.z < -0.15:
            v.co.z = -0.15 + (v.co.z + 0.15) * 0.2
    sme = bpy.data.meshes.new(name)
    bm.to_mesh(sme)
    bm.free()
    for poly in sme.polygons:
        poly.use_smooth = True
    ob = bpy.data.objects.new(name, sme)
    scene.collection.objects.link(ob)
    return ob


def make_bed():
    """Raised kerb around the main trunk: an irregular ring of dressed stones."""
    bm = bmesh.new()
    n = 44
    r_in, r_out, h = 2.15, 2.45, 0.32
    rings = []
    for k, (r, z) in enumerate(((r_in, -0.05), (r_in, h), (r_out, h), (r_out, -0.05))):
        ring = []
        for i in range(n):
            a = 2 * math.pi * i / n
            wob = 1.0 + 0.05 * math.sin(a * 3 + 0.4) + 0.03 * math.sin(a * 7)
            ring.append(bm.verts.new((0.30 + math.cos(a) * r * wob * 1.12, -0.05 + math.sin(a) * r * wob, z)))
        rings.append(ring)
    for k in range(3):
        a, b = rings[k], rings[k + 1]
        for i in range(n):
            f = bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
            f.smooth = False
    # soil disc inside
    centre = bm.verts.new((0.30, -0.05, 0.18))
    ring_soil = [bm.verts.new((0.30 + math.cos(2 * math.pi * i / n) * r_in * 1.12 * 0.999,
                               -0.05 + math.sin(2 * math.pi * i / n) * r_in * 0.999, 0.20)) for i in range(n)]
    for i in range(n):
        bm.faces.new((ring_soil[i], ring_soil[(i + 1) % n], centre))
    bme = bpy.data.meshes.new('Bed')
    bm.to_mesh(bme)
    bm.free()
    ob = bpy.data.objects.new('Bed', bme)
    scene.collection.objects.link(ob)
    return ob


stones = [
    make_stone('StoneTall', (-8.9, 2.25, 1.05), (0.95, 0.72, 1.32), 3, 0.8),
    make_stone('StoneMid', (-7.75, 2.95, 0.38), (0.78, 0.66, 0.55), 5, 0.6),
    make_stone('StoneSeat', (-5.2, 2.15, 0.18), (0.95, 0.55, 0.32), 9, 0.3),
    make_stone('StoneBed1', (2.35, 1.2, 0.30), (0.62, 0.48, 0.42), 13, 0.5),
    make_stone('StoneBed2', (-1.55, -1.45, 0.26), (0.55, 0.50, 0.36), 17, 0.4),
]
bed = make_bed()

scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 16 if QUICK else 64
scene.world = bpy.data.worlds.new('w')
scene.world.light_settings.distance = 3.0

for o in scene.objects:
    o.select_set(False)
bpy.context.view_layer.objects.active = bark
bark.select_set(True)

# bake into a temporary colour attribute, then copy AO into channel R
ao_attr = me.color_attributes.new('AO', 'FLOAT_COLOR', 'POINT')
me.color_attributes.active_color = ao_attr
ok = True
try:
    bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')
except Exception as e:  # pragma: no cover - environment dependent
    ok = False
    print('AO bake failed, falling back to analytic occlusion:', e)

col_attr = me.color_attributes['Col']
if ok:
    for i, (c, a) in enumerate(zip(col_attr.data, ao_attr.data)):
        ao = a.color[0]
        c.color = (ao, c.color[1], c.color[2], 1.0)
me.color_attributes.remove(ao_attr)
me.color_attributes.active_color = me.color_attributes['Col']
me.color_attributes.render_color_index = me.color_attributes.active_color_index


# AO for stones and bed (bark + foliage occlude them too)
for ob in stones + [bed]:
    sme = ob.data
    a = sme.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
    sme.color_attributes.active_color = a
    smat = bpy.data.materials.new('Stone')
    sme.materials.append(smat)
    for o in scene.objects:
        o.select_set(False)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    try:
        bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')
    except Exception as e:
        print('stone bake failed', e)
    # tint variation in G (weathering), B = 1 for "stone"
    for v, c in zip(sme.vertices, a.data):
        w = 0.5 + 0.5 * noise.noise(v.co * 0.9)
        c.color = (c.color[0], w, 1.0 if ob is not bed else 0.5, 1.0)

# foliage occlusion per rosette: how much canopy lies above it
kd = KDTree(len(rosettes))
for i, r in enumerate(rosettes):
    kd.insert(r['pos'], i)
kd.balance()
occ = []
for r in rosettes:
    p = r['pos']
    acc = 0.0
    for (q, j, d) in kd.find_range(p + UP * 1.6, 2.6):
        dz = q.z - p.z
        if dz > 0.15:
            hd = math.hypot(q.x - p.x, q.y - p.y)
            if hd < dz * 1.1 + 0.25:
                acc += 1.0 / (1.0 + dz * 0.4)
    occ.append(acc)
mx = sorted(occ)[int(len(occ) * 0.97)] or 1.0
occ = [min(1.0, o / mx) for o in occ]


# --------------------------------------------------------------- 5c. mirror
# Authored with the dragon limb towards -X; the photograph, taken from the
# north looking south at the building, shows it to the viewer's left — east.
# Mirror everything once so +X (east) carries the dragon.
MIRROR = Matrix.Scale(-1.0, 4, (1.0, 0.0, 0.0))
for ob in [bark] + stones + [bed]:
    ob.data.transform(MIRROR)
    ob.data.flip_normals()
for r in rosettes:
    r['pos'].x = -r['pos'].x
    r['dir'].x = -r['dir'].x
fruits = [(Vector((-p.x, p.y, p.z)), k) for p, k in fruits]
for b in branches:
    for p in b.pts:
        p.x = -p.x

# --------------------------------------------------------------- 6. save & export
bpy.data.objects.remove(ground)
bpy.data.objects.remove(foliage)

# the .blend gets the leaves too, as instanced planes, for offline renders
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BUILD, 'lanren-tree.blend'))

for o in scene.objects:
    o.select_set(o == bark)
bpy.ops.export_scene.gltf(
    filepath=os.path.join(BUILD, 'tree-raw.glb'),
    export_format='GLB',
    use_selection=True,
    export_apply=True,
    export_yup=True,
    export_texcoords=True,
    export_normals=True,
    export_materials='NONE',
    export_vertex_color='ACTIVE',
    export_all_vertex_colors=False,
)


for o in scene.objects:
    o.select_set(o in stones or o == bed)
bpy.ops.export_scene.gltf(
    filepath=os.path.join(BUILD, 'stones-raw.glb'), export_format='GLB', use_selection=True,
    export_apply=True, export_yup=True, export_texcoords=False, export_normals=True,
    export_materials='NONE', export_vertex_color='ACTIVE', export_all_vertex_colors=False)

# rosettes.bin — converted to the glTF/three frame: x, z, -y
STRIDE = 12
buf = bytearray()
for r, o in zip(rosettes, occ):
    p, d = r['pos'], r['dir']
    b = r['branch']
    flex = flex_of(b, len(b.pts) - 1)
    buf += struct.pack('<12f', p.x, p.z, -p.y, d.x, d.z, -d.y, r['size'], flex, o,
                       min(1.0, max(0.0, (p.z - 1.5) / 13.0)), rng.random(), rng.random())
with open(os.path.join(ASSETS, 'rosettes.bin'), 'wb') as fh:
    fh.write(buf)

fbuf = bytearray()
for p, k in fruits:
    fbuf += struct.pack('<4f', p.x, p.z, -p.y, k)
with open(os.path.join(ASSETS, 'fruits.bin'), 'wb') as fh:
    fh.write(fbuf)


def to3(v):
    return [round(v.x, 3), round(v.z, 3), round(-v.y, 3)]


xs = [r['pos'] for r in rosettes]
bounds = [[min(p.x for p in xs), min(p.z for p in xs), min(-p.y for p in xs)],
          [max(p.x for p in xs), max(p.z for p in xs), max(-p.y for p in xs)]]
dragon_dip = min(scaffolds['dragon'][0].pts, key=lambda p: p.z if p.x > 5 else 99)
meta = {
    'generator': 'scripts/lanren/build_tree.py',
    'blender': bpy.app.version_string,
    'seed': SEED,
    'frame': 'three.js / glTF Y-up; +X campus east along the No.1 building facade, -Z campus north towards the North Gate',
    'counts': {'branches': len(branches), 'rosettes': len(rosettes), 'fruits': len(fruits),
               'barkVertices': len(me.vertices)},
    'rosetteStride': STRIDE,
    'rosetteLayout': ['px', 'py', 'pz', 'dx', 'dy', 'dz', 'size', 'flex', 'occlusion', 'height', 'rand0', 'rand1'],
    'fruitLayout': ['px', 'py', 'pz', 'rand'],
    'canopyBounds': [[round(v, 2) for v in bounds[0]], [round(v, 2) for v in bounds[1]]],
    'anchors': {
        'trunkBase': to3(Vector((-0.3, 0.0, 0.8))),
        'fork': to3(Vector((0.1, 0.1, 3.0))),
        'dragonDip': to3(dragon_dip),
        'dragonRise': to3(scaffolds['dragon'][0].pts[-1]),
        'crownTop': to3(scaffolds['leader'][0].pts[-1]),
        'eastLimb': to3(scaffolds['east'][0].pts[-1]),
    },
    'aoBaked': ok,
    'reference': 'assets/images/web/lanshu-1600.jpg (区大伟 摄) — scaffold proportions read from this photograph; not a survey',
}
with open(os.path.join(ASSETS, 'tree.json'), 'w', encoding='utf-8') as fh:
    json.dump(meta, fh, ensure_ascii=False, indent=1)
print(json.dumps(meta['counts']), 'anchors', meta['anchors'])
