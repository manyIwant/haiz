"""HAIZ · 榄仁树 v2 — a growing Terminalia catappa on a small island.

Species concept model (not a survey of the campus tree): the defining
Aubréville architecture — a stout buttressed trunk carrying whorled,
near-horizontal tiers that shorten upward into a pagoda crown — plus one
long, low, dipping limb as a nod to the campus tree's "dragon" limb.

Every bark vertex carries the growth time at which it exists (_BIRTH) and
its ring radius (_RAD); the web shader shrinks rings that are not yet born
towards the branch axis, so shoots extend from their tips and thicken —
real structural growth, scrubbed by scroll. Rosettes carry the time their
leaves emerge; a few carry last year's red leaves and the time they drop.

Run: blender -b --python scripts/lanren/build_tree.py   (or the PyPI bpy wheel)
"""
import json
import math
import os
import random
import struct
import sys

import bpy  # noqa: I001  bpy must load before bmesh / mathutils
import bmesh
from mathutils import Vector, Matrix, noise
from mathutils.kdtree import KDTree

SEED = 1923
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
BUILD = os.path.join(ROOT, 'build', 'lanren')
ASSETS = os.path.join(ROOT, 'lanren', 'assets')
os.makedirs(BUILD, exist_ok=True)
os.makedirs(ASSETS, exist_ok=True)
QUICK = '--quick' in sys.argv
rng = random.Random(SEED)
UP = Vector((0, 0, 1))
WATER = -0.85          # water level (Blender Z) relative to the trunk base


# ------------------------------------------------------------------ helpers
def catmull(points, ds):
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


def rot_z(v, a):
    c, s = math.cos(a), math.sin(a)
    return Vector((v.x * c - v.y * s, v.x * s + v.y * c, v.z))


def horiz(v):
    h = Vector((v.x, v.y, 0))
    return h.normalized() if h.length > 1e-6 else Vector((1, 0, 0))


def wobble(pts, amp, freq, seed, fade=0.25):
    out = []
    L = max(1, len(pts) - 1)
    for i, p in enumerate(pts):
        w = min(1.0, (i / L) / fade) if fade > 0 else 1.0
        out.append(p + noise.noise_vector(p * freq + Vector((seed * 3.1, seed * 1.7, seed * 0.9))) * amp * w)
    return out


def island_height(x, y):
    """The island: a low rounded mound, rocky towards the shore."""
    r = math.hypot(x, y * 1.15)
    base = 0.25 * math.exp(-(r / 2.2) ** 2) + 1.05 * math.exp(-(r / 4.6) ** 2.2) - 1.05
    n = noise.noise(Vector((x * 0.35, y * 0.35, 3.1))) * 0.35 + noise.noise(Vector((x * 1.3, y * 1.3, 7.7))) * 0.08
    return base + n * min(1.0, r / 3.0) * 0.8


# ------------------------------------------------------------------ branch model
class Branch:
    def __init__(self, pts, r0, r1, kind, parent=None, depth=0, birth=(-9.0, -9.0), taper=0.8, prof=None):
        self.pts = pts
        n = len(pts)
        self.rad = [r1 + (r0 - r1) * (1 - i / max(1, n - 1)) ** taper for i in range(n)]
        self.kind, self.parent, self.depth, self.prof = kind, parent, depth, prof
        self.birth = birth          # (time at s=0, time at s=1)
        self.seed = rng.random() * 100
        self.children = []
        if parent:
            parent.children.append(self)

    def length(self):
        return sum((b - a).length for a, b in zip(self.pts, self.pts[1:]))

    def tangent(self, i):
        a = self.pts[max(0, i - 1)]
        b = self.pts[min(len(self.pts) - 1, i + 1)]
        return (b - a).normalized()

    def birth_at(self, i):
        s = i / max(1, len(self.pts) - 1)
        return self.birth[0] + (self.birth[1] - self.birth[0]) * s

    def path_at(self, i):
        base = self.parent.path_at(len(self.parent.pts) - 1) * 0 if False else 0
        return sum((b - a).length for a, b in zip(self.pts[:i], self.pts[1:i + 1])) + (self.base_path if hasattr(self, 'base_path') else 0)


branches, rosettes = [], []


def add(b, base_path=0.0):
    b.base_path = base_path
    branches.append(b)
    return b


def trunk_profile(i, n, th):
    h = i / max(1, n - 1)
    lobes = (0.22 * math.cos(5 * th + 0.6) + 0.13 * math.cos(3 * th + 2.1) + 0.08 * math.cos(7 * th + 4.0)
             + 0.05 * math.cos(2 * th + 1.0))
    flare = math.exp(-h * 8.0)
    return 1.0 + lobes * (0.3 + 1.5 * flare) * (1 - 0.6 * h) + 0.6 * flare


# ------------------------------------------------------------------ trunk & scaffold
# A mature, open-grown Terminalia: a short, massive, fluted trunk forking
# low into a few sinuous limbs that rise, then run out almost level. Leaves
# gather in flat pads at the ends of the branch systems: layered plates with
# sky between them, which is what gives the crown its depth.
FORK_H = 2.7
trunk = add(Branch(wobble(catmull([(0.0, 0.0, -0.5), (0.08, 0.03, 1.0), (0.14, -0.02, 2.0), (0.12, 0.0, FORK_H + 0.2)], 0.1),
                          0.06, 0.7, 1), 0.92, 0.66, 'trunk', taper=1.2, prof=trunk_profile))
FORK = Vector((0.12, 0.0, FORK_H))

# (azimuth°, rise°, limb length, arm length, end-height bias, radius)
LIMBS = [(8, 20, 7.0, 4.5, -1.5, 0.48), (74, 46, 5.6, 3.4, 0.6, 0.40), (138, 38, 6.4, 4.0, 0.0, 0.42),
         (205, 50, 5.2, 3.2, 1.0, 0.38), (268, 40, 6.2, 3.8, 0.2, 0.40), (322, 58, 4.4, 2.6, 2.2, 0.34)]
pads = []      # dict(c=centre, r=horizontal radius, t=thickness, branch=..., idx=...)


def arc_path(origin, az, rise, L, arm, hbias, seed):
    d = Vector((math.cos(az), math.sin(az), 0))
    side = rot_z(d, math.pi / 2)
    up_dir = (d * math.cos(rise) + UP * math.sin(rise)).normalized()
    p1 = origin + up_dir * L * 0.45 + side * rng.uniform(-0.4, 0.4)
    p2 = p1 + (d * 0.75 + UP * math.sin(rise) * 0.55).normalized() * L * 0.35 + side * rng.uniform(-0.6, 0.6)
    p3 = p2 + (d * 0.95 + UP * 0.12).normalized() * L * 0.3 + UP * hbias * 0.4
    p4 = p3 + (d + side * rng.uniform(-0.35, 0.35)).normalized() * arm + UP * (0.25 + hbias * 0.2)
    pts = catmull([origin, p1, p2, p3, p4], 0.1)
    return wobble(pts, 0.16, 0.45, seed, fade=0.12)


limbs = []
for k, (azd, rised, L, arm, hb, r0) in enumerate(LIMBS):
    az = math.radians(azd) + rng.uniform(-0.08, 0.08)
    if k == 0:   # the long, low limb: dips towards the water and rises again
        cps = [FORK + Vector((0.1, 0, -0.1)), (2.4, 0.2, 3.3), (4.8, 0.5, 3.0), (7.0, 0.8, 2.3), (8.7, 0.9, 1.85),
               (9.9, 0.75, 2.2), (10.8, 0.5, 3.3), (11.5, 0.3, 4.4), (12.4, 0.1, 5.0)]
        pts = wobble(catmull(cps, 0.1), 0.1, 0.6, 77)
    else:
        pts = arc_path(FORK + Vector((0, 0, rng.uniform(-0.2, 0.3))), az, math.radians(rised), L, arm, hb, k)
    b = add(Branch(pts, r0, 0.06, 'scaffold', trunk, 1, taper=0.55), base_path=FORK_H)
    limbs.append(b)

# ------------------------------------------------------------------ growth schedule
G_SEC = (0.00, 0.26)      # pad branches extend their outer part
TER_DUR = 0.16
TWIG_DUR = 0.10
EMERGE_DELAY = (0.02, 0.08)
grid = {}


def crowded(p, cell, rad, layer):
    k = (int(p.x // cell), int(p.y // cell), int(p.z // cell))
    g = grid.setdefault(layer, {})
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            for dz in (-1, 0, 1):
                for q in g.get((k[0] + dx, k[1] + dy, k[2] + dz), ()):
                    if (q - p).length < rad:
                        return True
    return False


def mark(p, cell, layer):
    grid.setdefault(layer, {}).setdefault((int(p.x // cell), int(p.y // cell), int(p.z // cell)), []).append(p.copy())


def wave(p):
    """The flush travels outward from the trunk and slightly upward."""
    return 0.10 * min(1.0, math.hypot(p.x, p.y) / 12.0) + 0.04 * min(1.0, max(0.0, p.z - 3) / 10)


def add_rosette(pos, d, size, t_emerge, pad, base=-9.0):
    if crowded(pos, 0.3, 0.165, 'ros'):
        return False
    mark(pos, 0.3, 'ros')
    rosettes.append(dict(pos=pos.copy(), dir=d.normalized(), size=size, t=t_emerge, pad=pad, base=base))
    return True


def in_pad(p, pad):
    c, r, t = pad['c'], pad['r'], pad['t']
    q = ((p.x - c.x) / r) ** 2 + ((p.y - c.y) / (r * pad['sq'])) ** 2 + ((p.z - c.z) / t) ** 2
    return q <= 1.0


def twig_fan(parent, idx, level, t_tip, pad):
    """Sympodial short shoots: a rosette, then 3-5 shoots fanning out (kept inside the pad)."""
    p = parent.pts[idx]
    d = parent.tangent(idx)
    h = horiz(d)
    add_rosette(p + UP * 0.02, d + UP * 0.6, rng.uniform(0.85, 1.15), max(t_tip, 0.02) + rng.uniform(*EMERGE_DELAY), pad,
                base=parent.birth_at(idx))
    if level <= 0:
        return
    k = rng.choice((3, 4, 4, 5))
    a0 = rng.uniform(0, 2 * math.pi)
    for j in range(k):
        ang = a0 + j * 2 * math.pi / k + rng.uniform(-0.3, 0.3)
        hd = horiz(h * 1.3 + rot_z(Vector((1, 0, 0)), ang))
        L = rng.uniform(0.24, 0.46)
        tip = p + hd * L + UP * rng.uniform(0.03, 0.16)
        if not in_pad(tip, pad) or crowded(tip, 0.3, 0.15, 'ros'):
            continue
        t0 = max(t_tip, 0.02) + rng.uniform(0.0, 0.05)
        tw = add(Branch([p.copy(), p.lerp(tip, 0.5) + UP * 0.03, tip], 0.012 + 0.003 * level, 0.006, 'twig', parent,
                        parent.depth + 1, birth=(t0, t0 + TWIG_DUR), taper=1.0))
        twig_fan(tw, 2, level - 1, t0 + TWIG_DUR, pad)


def shoot(p0, hd, L, elev, droop, seed):
    side = rot_z(hd, math.pi / 2)
    bend = rng.uniform(-0.2, 0.2)
    n = max(3, int(L / 0.16))
    pts = []
    for i in range(n + 1):
        s = L * i / n
        u = s / L
        z = math.sin(elev) * s - droop * s * s / L + 0.12 * max(0.0, u - 0.6) ** 2 * L
        pts.append(p0 + hd * math.cos(elev) * s + side * bend * s * s / L + UP * z)
    return wobble(pts, 0.03 * L / 2, 1.1, seed)


def fill_pad(pad, hub_branch, t_hub):
    """Two storeys of tertiaries radiate across the plate; twig fans carry the leaves."""
    for lift, rk in ((-0.15, 1.0), (pad['t'] * 0.55, 0.78)):
        fill_layer(pad, hub_branch, t_hub, lift, rk)


def fill_layer(pad, hub_branch, t_hub, lift, rk):
    c, r = pad['c'], pad['r'] * rk
    hub = hub_branch.pts[-1] + UP * lift
    n = max(5, int(r * 3.4))
    a0 = rng.uniform(0, 2 * math.pi)
    for j in range(n):
        ang = a0 + j * 2 * math.pi / n + rng.uniform(-0.25, 0.25)
        hd = Vector((math.cos(ang), math.sin(ang), 0))
        L = r * rng.uniform(0.65, 0.95)
        start = hub + UP * rng.uniform(-0.12, 0.18)
        pts = shoot(start, hd, L, math.radians(rng.uniform(-6, 14)), 0.05, j + c.x)
        pts = [q for q in pts if in_pad(q, pad)] or pts[:2]
        if len(pts) < 2:
            continue
        t0 = -0.24 + wave(pts[-1]) * 0.5 + rng.uniform(0, 0.04)
        ter = add(Branch(pts, 0.03 + 0.006 * r, 0.009, 'tertiary', hub_branch, hub_branch.depth + 1, birth=(t0, t0 + 0.36)))
        m = len(ter.pts)
        for q in range(2, m - 1, 2):
            if rng.random() < 0.8:
                # side fans along the shoot fill the plate in both directions
                twig_fan(ter, q, 1 if rng.random() < 0.6 else 2, ter.birth_at(q) + 0.02 + wave(ter.pts[q]), pad)
        twig_fan(ter, m - 1, 2, t0 + 0.36 + wave(ter.pts[-1]), pad)


def grow_pad(limb, idx, c, r, t, sq=1.0):
    """A secondary branch from the limb to a pad hub, then the pad itself."""
    p = limb.pts[idx]
    hub = c - UP * t * 0.35
    mid = p.lerp(hub, 0.55) + UP * rng.uniform(0.2, 0.6)
    pts = wobble(catmull([p, mid, hub], 0.12), 0.08, 0.8, c.x + c.y)
    t_end = G_SEC[1] * rng.uniform(0.6, 1.0) + wave(hub) * 0.5
    sec = add(Branch(pts, min(limb.rad[idx] * 0.7, 0.06 + 0.03 * r), 0.03, 'secondary', limb, limb.depth + 1))
    pad = dict(c=c, r=r, t=t, sq=sq * rng.uniform(0.8, 1.15))
    pads.append(pad)
    fill_pad(pad, sec, 0.0)


for k, limb in enumerate(limbs):
    n = len(limb.pts)
    tip = limb.pts[-1]
    out = horiz(tip - FORK)
    # the terminal pad, widest
    grow_pad(limb, n - 1, tip + out * 0.6 + UP * 0.4, rng.uniform(3.0, 3.7), rng.uniform(0.8, 1.05))
    # side pads at different heights: the layered look
    for frac, dz, side in ((0.42, -0.9, 1), (0.56, 0.5, -1), (0.68, 1.3, 1), (0.8, -0.3, -1), (0.92, 0.9, 1)):
        if k == 0 and frac < 0.6:
            continue
        i = int(frac * (n - 1))
        p = limb.pts[i]
        sd = rot_z(horiz(limb.tangent(i)), side * rng.uniform(0.9, 1.4))
        c = p + sd * rng.uniform(2.2, 3.2) + UP * (dz + rng.uniform(0.2, 0.9))
        grow_pad(limb, i, c, rng.uniform(2.1, 2.9), rng.uniform(0.7, 0.95))
# a crown pad above the fork, and two on the long limb's rising end
grow_pad(limbs[5], len(limbs[5].pts) - 1, limbs[5].pts[-1] + UP * 1.3, 3.2, 0.95)
grow_pad(limbs[3], len(limbs[3].pts) - 1, limbs[3].pts[-1] + UP * 2.0 + horiz(limbs[3].pts[-1]) * -1.5, 2.8, 0.9)
grow_pad(limbs[0], int(0.45 * (len(limbs[0].pts) - 1)), limbs[0].pts[int(0.45 * (len(limbs[0].pts) - 1))] + Vector((0.5, -2.2, 1.6)), 2.0, 0.55)

# surface roots over the island, always present
for k in range(9):
    ang = k / 9 * 2 * math.pi + rng.uniform(-0.2, 0.2)
    d = Vector((math.cos(ang), math.sin(ang), 0))
    L = rng.uniform(2.6, 4.6)
    pts = []
    for i in range(int(L / 0.12) + 1):
        s = i * 0.12
        q = d * (0.55 + s) + rot_z(d, math.pi / 2) * math.sin(s * 1.3 + k) * 0.25
        z = island_height(q.x, q.y) + 0.05 + 0.25 * math.exp(-s * 1.2) - 0.12 * max(0, s - L + 0.8)
        pts.append(Vector((q.x, q.y, z)))
    pts.insert(0, Vector((d.x * 0.35, d.y * 0.35, 0.45)))
    add(Branch(wobble(resample(pts, 0.1), 0.04, 1.6, 40 + k, 0.1), rng.uniform(0.2, 0.3), 0.025, 'root', trunk, 1,
               taper=0.6))

# last year's leaves: a few rosettes still hold old red leaves that drop as the flush begins
for r in rosettes:
    r['old'] = rng.uniform(0.02, 0.2) if (r['base'] <= 0.0 and rng.random() < 0.5) else -1.0

print('branches', len(branches), 'rosettes', len(rosettes), 'pads', len(pads))


# ------------------------------------------------------------------ mesh
def flex_of(b, i):
    path = b.base_path + sum((q - p).length for p, q in zip(b.pts[:i], b.pts[1:i + 1]))
    return max(0.0, min(1.0, max(0.0, (path - 3.0) / 12.0) ** 1.3 * (1 - min(1.0, b.rad[i] / 0.3)) ** 1.5))


BARK_TILE = 0.85


def build_mesh():
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new('UVMap')
    col = bm.verts.layers.float_color.new('Col')
    lb = bm.verts.layers.float.new('_BIRTH')
    lr = bm.verts.layers.float.new('_RAD')
    for b in branches:
        n = len(b.pts)
        if n < 2:
            continue
        r_base = b.rad[0]
        sides = {'trunk': 44, 'scaffold': max(10, min(28, int(r_base * 70))), 'root': max(8, int(r_base * 50)),
                 'secondary': 8 if r_base > 0.04 else 6, 'tertiary': 5, 'twig': 3}[b.kind]
        rep_u = max(1, round(2 * math.pi * r_base / BARK_TILE)) if b.kind != 'twig' else 1
        youth = {'trunk': 0.0, 'root': 0.0, 'scaffold': 0.05, 'secondary': 0.35, 'tertiary': 0.7, 'twig': 1.0}[b.kind]
        T = [b.tangent(i) for i in range(n)]
        Nn = T[0].orthogonal().normalized()
        frames = []
        for i in range(n):
            if i > 0:
                ax = T[i - 1].cross(T[i])
                if ax.length > 1e-6:
                    Nn = (Matrix.Rotation(T[i - 1].angle(T[i]), 3, ax.normalized()) @ Nn).normalized()
            frames.append((Nn.copy(), T[i].cross(Nn).normalized()))
        rings, vs, acc = [], [], 0.0
        for i in range(n):
            if i:
                acc += (b.pts[i] - b.pts[i - 1]).length
            vs.append(acc / BARK_TILE)
            Nv, Bv = frames[i]
            r = b.rad[i]
            if b.parent is not None and b.kind != 'root':
                r *= 1.0 + 0.35 * math.exp(-i / 1.5)
            fx, bt = flex_of(b, i), b.birth_at(i)
            ring = []
            for j in range(sides):
                th = 2 * math.pi * j / sides
                k = b.prof(i, n, th) if b.prof else 1.0
                off = (Nv * math.cos(th) + Bv * math.sin(th)) * r * k
                p = b.pts[i] + off
                if r > 0.06:
                    p += off.normalized() * r * 0.09 * noise.noise(p * 1.7 + Vector((b.seed, 0, 0)))
                v = bm.verts.new(p)
                v[col] = (1.0, fx, youth, 1.0)
                v[lb] = bt
                v[lr] = (p - b.pts[i]).length
                ring.append(v)
            rings.append(ring)
        for i in range(n - 1):
            a, c = rings[i], rings[i + 1]
            for j in range(sides):
                j2 = (j + 1) % sides
                f = bm.faces.new((a[j], a[j2], c[j2], c[j]))
                f.smooth = True
                u0, u1 = rep_u * j / sides, rep_u * (j + 1) / sides
                for loop, uv in zip(f.loops, ((u0, vs[i]), (u1, vs[i]), (u1, vs[i + 1]), (u0, vs[i + 1]))):
                    loop[uvl].uv = uv
        tipv = bm.verts.new(b.pts[-1] + T[-1] * b.rad[-1] * 0.8)
        tipv[col] = (1.0, flex_of(b, n - 1), youth, 1.0)
        tipv[lb] = b.birth_at(n - 1)
        tipv[lr] = b.rad[-1] * 0.8
        for j in range(sides):
            f = bm.faces.new((rings[-1][j], rings[-1][(j + 1) % sides], tipv))
            f.smooth = True
            for loop in f.loops:
                loop[uvl].uv = (0.5 * rep_u, vs[-1] + 0.05)
    # growth data travels as a second UV set (TEXCOORD_1 = birth, ring radius):
    # gltfpack keeps standard attributes but drops custom ones. The glTF
    # exporter writes v as 1 - v, so store 1 - radius.
    grow = bm.loops.layers.uv.new('Grow')
    for f in bm.faces:
        for loop in f.loops:
            loop[grow].uv = (loop.vert[lb], 1.0 - loop.vert[lr])
    bm.verts.layers.float.remove(lb)
    bm.verts.layers.float.remove(lr)
    me = bpy.data.meshes.new('lanren_bark')
    bm.to_mesh(me)
    bm.free()
    me.uv_layers.active_index = 0
    return me


def build_island():
    """Island mound + shoreline boulders, as one mesh with colour (ao, rock, wet)."""
    bm = bmesh.new()
    R, N = 8.5, 120 if not QUICK else 70
    verts = {}
    for i in range(N + 1):
        for j in range(N + 1):
            x = -R + 2 * R * i / N
            y = -R + 2 * R * j / N
            z = island_height(x, y)
            verts[i, j] = bm.verts.new((x, y, z))
    for i in range(N):
        for j in range(N):
            zs = [verts[a].co.z for a in ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))]
            if max(zs) < WATER - 0.5:
                continue
            f = bm.faces.new((verts[i, j], verts[i + 1, j], verts[i + 1, j + 1], verts[i, j + 1]))
            f.smooth = True
    for k in range(11):
        ang = k / 11 * 2 * math.pi + rng.uniform(-0.25, 0.25)
        rr = rng.uniform(3.6, 5.6)
        c = Vector((math.cos(ang) * rr, math.sin(ang) * rr / 1.15, 0))
        c.z = island_height(c.x, c.y) + rng.uniform(-0.1, 0.25)
        sc = Vector((rng.uniform(0.5, 1.2), rng.uniform(0.45, 1.0), rng.uniform(0.35, 0.8)))
        ret = bmesh.ops.create_icosphere(bm, subdivisions=4, radius=1.0)
        off = Vector((k * 1.7, k * 0.3, k * 2.9))
        for v in ret['verts']:
            p = v.co.copy()
            d = sum(0.28 * 0.5 ** o * noise.noise(p * 1.1 * 2.1 ** o + off) for o in range(4))
            v.co = Vector((p.x * sc.x, p.y * sc.y, max(p.z, -0.6) * sc.z)) * (1 + d) + c
        for f in ret['faces'] if 'faces' in ret else []:
            f.smooth = True
    for f in bm.faces:
        f.smooth = True
    me = bpy.data.meshes.new('island')
    bm.to_mesh(me)
    bm.free()
    return me


bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
bark_me = build_mesh()
bark = bpy.data.objects.new('LanrenBark', bark_me)
scene.collection.objects.link(bark)
isl_me = build_island()
island = bpy.data.objects.new('Island', isl_me)
scene.collection.objects.link(island)
print('bark verts', len(bark_me.vertices), 'island verts', len(isl_me.vertices))

for me in (bark_me, isl_me):
    me.materials.append(bpy.data.materials.new('m_' + me.name))

# occluders for the bake: rosette discs approximate the full canopy
bmf = bmesh.new()
for r in rosettes:
    bmesh.ops.create_circle(bmf, cap_ends=True, segments=7, radius=0.24 * r['size'],
                            matrix=Matrix.Translation(r['pos'] + UP * 0.03))
fol_me = bpy.data.meshes.new('fol')
bmf.to_mesh(fol_me)
bmf.free()
fol = bpy.data.objects.new('BakeFoliage', fol_me)
scene.collection.objects.link(fol)

scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 16 if QUICK else 48
scene.world = bpy.data.worlds.new('w')
scene.world.light_settings.distance = 3.0


def bake_ao(ob, keep):
    me = ob.data
    ao = me.color_attributes.new('AO', 'FLOAT_COLOR', 'POINT')
    me.color_attributes.active_color = ao
    for o in scene.objects:
        o.select_set(False)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.bake(type='AO', target='VERTEX_COLORS')
    vals = [c.color[0] for c in ao.data]
    me.color_attributes.remove(ao)
    return vals


bark_ao = bake_ao(bark, True)
col = bark_me.color_attributes['Col']
for c, a in zip(col.data, bark_ao):
    c.color = (a, c.color[1], c.color[2], 1.0)
bark_me.color_attributes.active_color = col
bark_me.color_attributes.render_color_index = bark_me.color_attributes.active_color_index

isl_ao = bake_ao(island, True)
icol = isl_me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
for v, c, a in zip(isl_me.vertices, icol.data, isl_ao):
    slope = 1 - max(0.0, v.normal.z)
    rock = min(1.0, slope * 2.2 + max(0.0, math.hypot(v.co.x, v.co.y) - 3.4) * 0.35)
    wet = max(0.0, min(1.0, 1 - (v.co.z - WATER) / 0.35))
    icol.data[v.index].color = (a, rock, wet, 1.0)
isl_me.color_attributes.active_color = icol
isl_me.color_attributes.render_color_index = isl_me.color_attributes.active_color_index

# rosette sky occlusion (how much canopy lies above)
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
        if dz > 0.15 and math.hypot(q.x - p.x, q.y - p.y) < dz * 1.1 + 0.25:
            acc += 1.0 / (1.0 + dz * 0.4)
    occ.append(acc)
mx = sorted(occ)[int(len(occ) * 0.97)] or 1.0
occ = [min(1.0, o / mx) for o in occ]

bpy.data.objects.remove(fol)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BUILD, 'lanren-tree.blend'))


def export(objs, name):
    for o in scene.objects:
        o.select_set(o in objs)
    bpy.ops.export_scene.gltf(filepath=os.path.join(BUILD, name), export_format='GLB', use_selection=True,
                              export_apply=True, export_yup=True, export_texcoords=True, export_normals=True,
                              export_materials='NONE', export_vertex_color='ACTIVE', export_all_vertex_colors=False)


export([bark], 'tree-raw.glb')
export([island], 'island-raw.glb')

# rosettes.bin (three frame: x, z, -y): pos3 dir3 size flex occ tEmerge tOldDrop rand
buf = bytearray()
for r, o in zip(rosettes, occ):
    p, d = r['pos'], r['dir']
    flex = max(0.0, min(1.0, (math.hypot(p.x, p.y) / 11.0) ** 1.2 * 0.8 + 0.2))
    c = r['pad']['c']
    buf += struct.pack('<15f', p.x, p.z, -p.y, d.x, d.z, -d.y, r['size'], flex, o, r['t'], r['old'], rng.random(),
                       c.x, c.z, -c.y)
with open(os.path.join(ASSETS, 'rosettes.bin'), 'wb') as fh:
    fh.write(buf)
for stale in ('fruits.bin', 'stones.glb'):
    if os.path.exists(os.path.join(ASSETS, stale)):
        os.remove(os.path.join(ASSETS, stale))


def to3(v):
    return [round(v.x, 3), round(v.z, 3), round(-v.y, 3)]


ts = sorted(r['t'] for r in rosettes)
meta = {
    'generator': 'scripts/lanren/build_tree.py (v2: growing species concept model)',
    'blender': bpy.app.version_string, 'seed': SEED,
    'frame': 'three.js Y-up; tree base at origin; water plane at y = %.2f' % WATER,
    'water': WATER,
    'counts': {'branches': len(branches), 'rosettes': len(rosettes), 'barkVertices': len(bark_me.vertices)},
    'rosetteStride': 15,
    'rosetteLayout': ['px', 'py', 'pz', 'dx', 'dy', 'dz', 'size', 'flex', 'occlusion', 'tEmerge', 'tOldDrop', 'rand', 'padX', 'padY', 'padZ'], 'pads': len(pads),
    'growth': {'emergeRange': [round(ts[0], 3), round(ts[-1], 3)], 'emergeMedian': round(ts[len(ts) // 2], 3)},
    'anchors': {'trunk': to3(Vector((0.1, 0, 1.6))), 'limbDip': to3(Vector((8.7, 0.9, 1.85)))},
    'note': 'Species concept model of Terminalia catappa (tiered Aubréville architecture). Not a survey of the campus tree.'
}
with open(os.path.join(ASSETS, 'tree.json'), 'w', encoding='utf-8') as fh:
    json.dump(meta, fh, ensure_ascii=False, indent=1)
print(json.dumps(meta['counts']), meta['growth'])
