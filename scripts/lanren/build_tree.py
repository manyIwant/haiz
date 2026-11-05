"""HAIZ · 榄仁树 v3 — a mature, open-grown Terminalia catappa on a granite islet.

Species concept model (not a survey of the campus tree). v3 rebuilds the tree
for volume and silhouette:

1. **Scaffold** — an art-directed short, buttressed trunk that forks into a
   few sinuous limbs (rising, then running out nearly level: Terminalia's
   plagiotropic, tiered habit), with one long, low limb.
2. **Crown envelope** — a broad, slightly asymmetric dome made of loose tiers
   of flattened leaf clumps with sky between them (Poisson-disk spaced).
3. **Space colonisation** (Runions et al. 2007) grows every finer branch from
   the scaffold towards those clumps, so the branching is irregular, never
   repeats and always fills real 3D volume. Radii follow the pipe model.
4. **Growth data** — every bark vertex carries the growth time at which it
   exists and its ring radius (TEXCOORD_1); this season's shoots extend from
   the tips while scrolling. Rosettes (leaf clusters at twig ends) carry their
   emergence time, clump centre and canopy occlusion; last year's red leaves sit
   where the new shoots begin and carry the time they drop.

Run: blender -b --python scripts/lanren/build_tree.py   (or the PyPI bpy wheel)
     add -- --quick for a fast low-sample bake while iterating
"""
import json
import math
import os
import random
import struct
import sys
import time

import bpy  # noqa: I001  bpy must load before bmesh / mathutils
import bmesh
import numpy as np
from mathutils import Vector, Matrix, noise
from mathutils.kdtree import KDTree

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
BUILD = os.path.join(ROOT, 'build', 'lanren')
ASSETS = os.path.join(ROOT, 'lanren', 'assets')
os.makedirs(BUILD, exist_ok=True)
os.makedirs(ASSETS, exist_ok=True)
QUICK = '--quick' in sys.argv
T0 = time.time()

# ------------------------------------------------------------------ parameters
# Every art-directable number lives here (metres, degrees, growth units 0..1).
P = {
    'seed': int(os.environ.get('TREE_SEED', 2611)),
    'water': -0.85,
    'trunk': {'base': -0.75, 'fork': 3.05, 'r_base': 0.98, 'r_fork': 0.68, 'lean': (0.22, 0.06)},
    # crown: a dome with a flattened top, wider towards the long limb (−x)
    'crown': {'R': 12.2, 'asym': (0.13, math.radians(180)), 'wobble': 0.07, 'top': 15.2, 'rim': 4.6,
              'under_centre': 7.2, 'shell': 2.6, 'spacing': 2.05, 'tier': 2.9,
              'clump_r': (1.0, 1.7), 'clump_h': (0.45, 0.8), 'pts_per_m3': 14.0,
              'mass_r': (2.8, 4.4), 'mass_h': (1.5, 2.3), 'top_masses': 5},
    'sc': {'step': 0.24, 'influence': 6.5, 'kill': 0.36, 'momentum': 0.85, 'jitter': 0.16,
           'up': 0.05, 'level': 0.8, 'min_z': -0.4, 'max_z': 0.72, 'max_iter': 320},
    'pipe': {'tip': 0.009, 'exp': 2.12},
    # limbs: number of elbows and how far each turns (degrees)
    'elbow': {'n': (2, 4), 'az': 30, 'el': 14},
    # colonised branches kink now and then (probability per step, strength)
    'kink': (0.075, 0.75),
    # sympodial short shoots fanning out from every tip, each ending in a rosette
    'twig': {'fan': (3, 6), 'len': (0.16, 0.38), 'spread': 70, 'rise': (2, 18), 'gap': 0.15, 'second': 0.55},
    # this season: shoots of length L_new extend from the tips, then leaves open
    'growth': {'L_new': (0.32, 0.95), 'start': (0.02, 0.26), 'shoot': 0.12, 'leaf_delay': (0.015, 0.06),
               'old_fraction': 0.72, 'old_drop': (0.03, 0.34)},
    'bark_tile': 0.9,
}
rng = random.Random(P['seed'])
rng_isl = random.Random(P['seed'] * 7 + 1)   # islet and roots: their own stream
# mathutils.noise_vector draws on a session-seeded state: pin it, or every build differs
noise.seed_set(P['seed'])
np_rng = np.random.default_rng(P['seed'])
UP = Vector((0, 0, 1))
WATER = P['water']


def ss(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return a + (b - a) * t


def dir_of(az_deg, el_deg):
    a, e = math.radians(az_deg), math.radians(el_deg)
    return Vector((math.cos(a) * math.cos(e), math.sin(a) * math.cos(e), math.sin(e)))


def horiz(v):
    h = Vector((v.x, v.y, 0))
    return h.normalized() if h.length > 1e-6 else Vector((1, 0, 0))


# ------------------------------------------------------------------ the islet
# Hainan's coasts are strewn with rounded granite boulders: a few large ones
# hold the roots, smaller ones run into the water.
def make_boulders():
    """Granite tors: a few big rounded blocks round the trunk (some split along
    joints), medium blocks on the slopes, cobbles at the waterline."""
    out = []
    big = [(-2.3, 1.8, 2.2, 1.5, 0.5, 3.0), (2.0, -2.1, 1.9, 1.35, 0.42, 2.6), (3.0, 1.7, 1.5, 1.1, 0.3, 3.2),
           (-3.1, -1.6, 1.6, 1.2, 0.34, 2.4), (0.4, 3.4, 1.3, 1.0, 0.2, 2.8), (-0.7, -3.5, 1.15, 0.85, 0.12, 2.5)]
    for (x, y, rx, ry, top, pw) in big:
        out.append(dict(x=x, y=y, rx=rx, ry=ry, top=top, p=pw, rot=rng_isl.uniform(0, math.pi), seed=rng_isl.random() * 50))
    for k in range(13):
        ang = k / 13 * 2 * math.pi + rng_isl.uniform(-0.25, 0.25)
        rr = rng_isl.uniform(3.9, 5.6)
        sc = rng_isl.uniform(0.6, 1.3)
        out.append(dict(x=math.cos(ang) * rr, y=math.sin(ang) * rr * 0.86, rx=sc * rng_isl.uniform(0.9, 1.3), ry=sc * rng_isl.uniform(0.65, 1.0),
                        top=rng_isl.uniform(-0.6, 0.0) + sc * 0.22, p=rng_isl.uniform(2.2, 3.2), rot=rng_isl.uniform(0, math.pi), seed=rng_isl.random() * 50))
    for k in range(22):   # cobbles at the waterline
        ang = rng_isl.uniform(0, 2 * math.pi)
        rr = rng_isl.uniform(5.6, 7.4)
        sc = rng_isl.uniform(0.25, 0.6)
        out.append(dict(x=math.cos(ang) * rr, y=math.sin(ang) * rr * 0.86, rx=sc, ry=sc * rng_isl.uniform(0.7, 1.0),
                        top=WATER + rng_isl.uniform(-0.05, 0.22), p=rng_isl.uniform(2.0, 2.6), rot=rng_isl.uniform(0, math.pi), seed=rng_isl.random() * 50))
    return out


BOULDERS = make_boulders()
for _ in range(146):   # the v3 tree was art-directed with these draws spent on the old islet
    rng.random()


def mound(x, y):
    r = math.hypot(x, y * 1.12)
    base = 0.32 * math.exp(-(r / 2.0) ** 2) + 0.95 * math.exp(-(r / 4.9) ** 2.4) - 1.08
    n = noise.noise(Vector((x * 0.33, y * 0.33, 3.1))) * 0.3 + noise.noise(Vector((x * 1.4, y * 1.4, 7.7))) * 0.06
    return base + n * min(1.0, r / 3.0) * 0.7


def boulder_top(b, x, y):
    """A rounded granite block: squarish in plan (superellipse), steep flanks,
    a broad slightly tilted top, deep joints that split big blocks."""
    c, s = math.cos(b['rot']), math.sin(b['rot'])
    dx, dy = x - b['x'], y - b['y']
    w = noise.noise(Vector((dx * 0.6, dy * 0.6, b['seed'] + 3.0)))
    u = (dx * c + dy * s) / (b['rx'] * (1 + 0.14 * w))
    v = (-dx * s + dy * c) / (b['ry'] * (1 + 0.14 * w))
    pw = b.get('p', 2.0)
    d = (abs(u) ** pw + abs(v) ** pw) ** (1.0 / pw)
    if d >= 1:
        return -99.0
    q = 1 - d * d
    R = b['rx']
    p = Vector((x * 0.8, y * 0.8, b['seed']))
    h = R * 0.62 * (q ** 0.3)
    h *= 1 + 0.1 * noise.noise(p) + 0.05 * noise.noise(p * 2.9) + 0.025 * noise.noise(p * 8.1)
    tilt = 0.1 * (u * math.cos(b['seed']) + v * math.sin(b['seed']))
    h = min(h, R * 0.52 + tilt * R)
    # joints: deep, slightly wandering grooves across the bigger blocks
    if R > 1.1:
        ja = b['seed'] * 1.7
        jl = abs((dx * math.cos(ja) + dy * math.sin(ja)) + 0.25 * noise.noise(Vector((x * 0.7, y * 0.7, b['seed']))))
        h -= 0.26 * max(0.0, 1 - jl / 0.09) * min(1.0, q * 3)
    small = abs(noise.noise(Vector((x * 2.2, y * 2.2, b['seed'] * 2.0))))
    h -= 0.05 * max(0.0, 0.06 - small) / 0.06 * min(1.0, q * 4)
    return b['top'] - R * 0.62 + h


def ground(x, y):
    """(height, rockiness)"""
    g = mound(x, y)
    rock = 0.0
    for b in BOULDERS:
        t = boulder_top(b, x, y)
        if t > g:
            rock = max(rock, min(1.0, (t - g) * 6))
            g = t
    return g, rock


# ------------------------------------------------------------------ tree graph
pos, par, kids, rspec, dirs, kind, grow_ok = [], [], [], [], [], [], []
K_TRUNK, K_LIMB, K_SC, K_ROOT = 0, 1, 2, 3


def add_node(p, parent, d, r=0.0, k=K_SC, can_grow=True):
    pos.append(p.copy())
    par.append(parent)
    kids.append([])
    rspec.append(r)
    dirs.append(d.normalized())
    kind.append(k)
    grow_ok.append(can_grow)
    i = len(pos) - 1
    if parent >= 0:
        kids[parent].append(i)
    return i


def wobble_vec(p, seed, freq):
    return noise.noise_vector(p * freq + Vector((seed * 3.1, seed * 1.7, seed * 0.9)))


STEP = P['sc']['step']

# trunk
tr = P['trunk']
trunk_nodes = []
n_tr = int((tr['fork'] - tr['base']) / 0.12)
prev = -1
for i in range(n_tr + 1):
    s = i / n_tr
    z = lerp(tr['base'], tr['fork'], s)
    lean = s ** 1.6
    p = Vector((tr['lean'][0] * lean, tr['lean'][1] * lean, z)) + wobble_vec(Vector((0, 0, z)), 1, 0.5) * 0.05 * s
    r = lerp(tr['r_base'], tr['r_fork'], s ** 0.8)
    prev = add_node(p, prev, UP, r, K_TRUNK, False)
    trunk_nodes.append(prev)


def limb(from_node, az, e0, e1, L, r0, r1, upturn=0.0, drift=0.0, seed=0.0, grow_from=0.25, dip=None):
    """A scaffold limb: starts at elevation e0, flattens to e1 (plagiotropic),
    may turn up at the end; sinuous by noise. Returns its node list."""
    p = pos[from_node].copy()
    n = max(3, int(L / STEP))
    nodes = []
    prev = from_node
    # sympodial elbows: Terminalia limbs run straight, then turn where a side
    # bud took over; each elbow is a short, firm change of direction that stays
    elbows = [(rng.uniform(0.18, 0.88), rng.uniform(-P['elbow']['az'], P['elbow']['az']), rng.uniform(-P['elbow']['el'], P['elbow']['el']))
              for _ in range(rng.randint(*P['elbow']['n']))]
    for i in range(1, n + 1):
        s = i / n
        e = lerp(e0, e1, ss(0.0, 0.75, s)) + upturn * ss(0.72, 1.0, s)
        if dip:
            e += dip[0] * math.sin(math.pi * min(1.0, s / dip[1])) * (1 if s < dip[1] else 0)
        a = az + drift * math.sin(s * math.pi * 1.4 + seed)
        for (se, ka, ke) in elbows:
            k = ss(se - 0.035, se + 0.035, s)
            a += ka * k
            e += ke * k
        d = dir_of(a, e)
        d = (d + wobble_vec(p, seed, 0.35) * 0.22).normalized()
        p = p + d * STEP
        r = lerp(r0, r1, s ** 0.9)
        prev = add_node(p, prev, d, r, K_LIMB, s >= grow_from)
        nodes.append(prev)
    return nodes


def at(nodes, frac):
    return nodes[min(len(nodes) - 1, max(0, int(frac * (len(nodes) - 1))))]


FORK = trunk_nodes[-1]
FORK_LOW = trunk_nodes[int(0.80 * (len(trunk_nodes) - 1))]
FORK_MID = trunk_nodes[int(0.90 * (len(trunk_nodes) - 1))]

# the long, low limb (west, −x): reaches out, dips, rises again
dragon = limb(FORK_LOW, 196, 14, -9, 11.6, 0.44, 0.08, upturn=34, drift=10, seed=3, grow_from=0.35)
for f, az, e0, e1, L, r in ((0.45, 150, 30, 12, 4.6, 0.14), (0.58, 240, 32, 10, 4.8, 0.14),
                            (0.74, 160, 38, 16, 3.8, 0.11), (0.86, 225, 40, 14, 3.4, 0.10)):
    limb(at(dragon, f), az, e0, e1, L, r, 0.04, upturn=12, drift=8, seed=f * 7)

# codominant stems from the fork, each splitting again
STEMS = [  # az, e0, e1, L, r0, r1, children: (frac, daz, e0, e1, L, r)
    (28, 52, 20, 6.6, 0.52, 0.18, [(0.55, -34, 30, 10, 5.6, 0.2), (0.82, 30, 36, 16, 4.6, 0.15), (0.35, 70, 44, 20, 4.4, 0.14)]),
    (122, 56, 24, 6.2, 0.5, 0.17, [(0.6, -28, 34, 12, 5.2, 0.18), (0.85, 34, 40, 18, 4.4, 0.14), (0.38, 75, 46, 16, 3.8, 0.12)]),
    (250, 50, 20, 6.8, 0.5, 0.17, [(0.58, -32, 30, 10, 5.4, 0.18), (0.84, 30, 34, 14, 4.6, 0.15), (0.4, -80, 42, 14, 4.0, 0.13)]),
    (330, 38, 8, 7.4, 0.42, 0.14, [(0.5, -40, 26, 6, 4.8, 0.15), (0.78, 36, 30, 10, 4.2, 0.13)]),
    (84, 76, 52, 6.0, 0.42, 0.15, [(0.65, -60, 50, 30, 4.4, 0.15), (0.72, 80, 48, 26, 4.2, 0.14), (0.9, 170, 52, 34, 3.6, 0.12)]),
]
stems = []
for k, (az, e0, e1, L, r0, r1, children) in enumerate(STEMS):
    base = FORK if k != 3 else FORK_MID
    az += rng.uniform(-6, 6)
    st = limb(base, az, e0, e1, L, r0, r1, upturn=10, drift=12, seed=k * 5 + 1)
    stems.append(st)
    for (f, daz, ce0, ce1, cL, cr) in children:
        limb(at(st, f), az + daz + rng.uniform(-8, 8), ce0, ce1, cL * rng.uniform(0.9, 1.1), cr, 0.035,
             upturn=rng.uniform(8, 20), drift=10, seed=k * 11 + f * 13)

n_scaffold = len(pos)
print('scaffold nodes', n_scaffold, '%.1fs' % (time.time() - T0))


# ------------------------------------------------------------------ crown envelope → clumps → attraction points
C = P['crown']
CX, CY = 0.6, 0.2


def crown_R(theta):
    a, ph = C['asym']
    return C['R'] * (1 + a * math.cos(theta - ph) + C['wobble'] * math.sin(2 * theta + 1.1)
                     + 0.04 * math.sin(3 * theta + 2.3))


def crown_top(rn):
    """height of the outer crown surface at normalised radius rn (0 centre … 1 rim)"""
    return C['rim'] + (C['top'] - C['rim']) * max(0.0, 1 - rn ** 2.3) ** 0.55


def crown_under(rn):
    """lowest foliage at rn: open inside (trunk and limbs visible from below)"""
    return lerp(C['under_centre'], C['rim'] - 0.9, ss(0.25, 1.0, rn))


clumps = []
grid = {}
cell = C['spacing']


def far_enough(p, dmin):
    k = (int(math.floor(p.x / cell)), int(math.floor(p.y / cell)), int(math.floor(p.z / cell)))
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            for dz in (-1, 0, 1):
                for q in grid.get((k[0] + dx, k[1] + dy, k[2] + dz), ()):
                    if (q - p).length < dmin:
                        return False
    grid.setdefault(k, []).append(p.copy())
    return True


# foliage masses: every major limb system carries its own cloud of leaves,
# so the crown reads as lobes with sky between them, not one smooth dome
limb_ends = [i for i in range(n_scaffold) if kind[i] == K_LIMB and not any(kind[k] == K_LIMB for k in kids[i])]
masses = []
for i in limb_ends:
    e = pos[i]
    out = horiz(e - Vector((CX, CY, 0)))
    c = e + out * rng.uniform(0.6, 1.6) + UP * rng.uniform(0.4, 1.4)
    masses.append(dict(c=c, rx=rng.uniform(*C['mass_r']), rz=rng.uniform(*C['mass_h'])))
for k in range(C['top_masses']):
    th = k / C['top_masses'] * 2 * math.pi + rng.uniform(-0.3, 0.3)
    rn = rng.uniform(0.15, 0.55)
    z = crown_top(rn) - rng.uniform(0.6, 1.4)
    masses.append(dict(c=Vector((CX + math.cos(th) * rn * C['R'], CY + math.sin(th) * rn * C['R'], z)),
                       rx=rng.uniform(*C['mass_r']), rz=rng.uniform(*C['mass_h'])))
print('masses', len(masses))


def in_masses(p):
    best = 9.0
    for m in masses:
        d = m['c'] - p
        q = (d.x / m['rx']) ** 2 + (d.y / m['rx']) ** 2 + (d.z / m['rz']) ** 2
        best = min(best, q)
    return best


tries = 0
while tries < 90000:
    tries += 1
    th = rng.uniform(0, 2 * math.pi)
    R = crown_R(th)
    rn = math.sqrt(rng.random()) * (1.06 if rng.random() > 0.08 else 1.16)
    z = rng.uniform(crown_under(min(rn, 1)), crown_top(min(rn, 1)) + 0.4)
    p = Vector((CX + math.cos(th) * rn * R, CY + math.sin(th) * rn * R, z))
    depth = min(crown_top(min(rn, 1)) - z, (1.06 - rn) * R)
    if depth > C['shell'] and rng.random() > 0.1:
        continue
    if noise.noise(p * 0.21 + Vector((4.0, 7.0, 1.0))) > 0.38:     # open windows in the crown
        continue
    q = in_masses(p) + 0.35 * noise.noise(p * 0.45)
    if q > 1.0:
        continue
    tier = 0.5 + 0.5 * math.cos(2 * math.pi * (z - C['rim']) / C['tier'])
    if rng.random() > 0.5 + 0.5 * tier ** (0.5 + rn):
        continue
    if math.hypot(p.x, p.y) < 2.2 and p.z < 9:
        continue
    if not far_enough(p, C['spacing'] * rng.uniform(0.85, 1.15)):
        continue
    clumps.append(dict(c=p, rx=rng.uniform(*C['clump_r']) * (1 + 0.2 * rn), rz=rng.uniform(*C['clump_h'])))
print('clumps', len(clumps))

attr = []
for cl in clumps:
    c, rx, rz = cl['c'], cl['rx'], cl['rz']
    vol = 4 / 3 * math.pi * rx * rx * rz
    n = max(8, int(vol * C['pts_per_m3']))
    # clumps are domes: points thin out underneath
    for _ in range(n):
        while True:
            u = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(-1, 1)))
            if u.length <= 1:
                break
        if u.z < -0.3 and rng.random() < 0.6:
            u.z = -u.z * 0.5
        attr.append(Vector((c.x + u.x * rx, c.y + u.y * rx, c.z + u.z * rz)))
print('attraction points', len(attr))


# ------------------------------------------------------------------ space colonisation
SC = P['sc']


def colonise(points):
    alive = list(points)
    for it in range(SC['max_iter']):
        idx = [i for i in range(len(pos)) if grow_ok[i]]
        kd = KDTree(len(idx))
        for j, i in enumerate(idx):
            kd.insert(pos[i], j)
        kd.balance()
        acc = {}
        for a in alive:
            co, j, d = kd.find(a)
            if j is None or d > SC['influence'] or d < 1e-6:
                continue
            i = idx[j]
            v = (a - co) / d
            if i in acc:
                acc[i][0] += v
                acc[i][1] += 1
            else:
                acc[i] = [v.copy(), 1]
        new = []
        for i, (v, cnt) in acc.items():
            if v.length < 1e-4:
                continue
            d = v.normalized()
            mom = SC['momentum'] * (1.0 if kind[i] == K_SC else 0.55)
            d = d + dirs[i] * mom + Vector((0, 0, SC['up'])) + wobble_vec(pos[i], 9, 1.3) * SC['jitter']
            # now and then a branch kinks (a side bud takes over), so no curve is too smooth
            hk = (i * 2654435761 + len(kids[i]) * 97) % 10007 / 10007.0
            if hk < P['kink'][0]:
                d = d + wobble_vec(pos[i] * 3.0, 21, 2.7).normalized() * P['kink'][1]
            d.z *= SC['level']
            d.normalize()
            # branches lean outward and up, never hang straight down or shoot vertically
            if d.z < SC['min_z'] or d.z > SC['max_z']:
                hz = horiz(d) if Vector((d.x, d.y, 0)).length > 1e-4 else horiz(dirs[i])
                z = min(SC['max_z'], max(SC['min_z'], d.z))
                d = (hz * math.sqrt(1 - z * z) + UP * z).normalized()
            q = pos[i] + d * STEP
            if any((pos[k] - q).length < STEP * 0.35 for k in kids[i]):
                continue
            new.append(add_node(q, i, d, 0.0, K_SC, True))
        if not new:
            break
        kn = KDTree(len(new))
        for j, i in enumerate(new):
            kn.insert(pos[i], j)
        kn.balance()
        alive = [a for a in alive if kn.find(a)[2] > SC['kill']]
        if it % 20 == 0:
            print('  sc iter', it, 'nodes', len(pos), 'alive', len(alive), '%.1fs' % (time.time() - T0))
        if not alive:
            break
    print('  sc stopped at iter', it, 'alive', len(alive))


colonise(attr)

# sympodial fans: Terminalia's leaf rosettes sit on short shoots that fan out
TW = P['twig']
fan_grid = {}


def fan_free(p):
    g = TW['gap']
    k = (int(p.x // g), int(p.y // g), int(p.z // g))
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            for dz in (-1, 0, 1):
                for q in fan_grid.get((k[0] + dx, k[1] + dy, k[2] + dz), ()):
                    if (q - p).length < g:
                        return False
    fan_grid.setdefault(k, []).append(p.copy())
    return True


tips = [i for i in range(len(pos)) if not kids[i] and kind[i] == K_SC]
for i in tips:
    fan_free(pos[i])
for i in tips:
    d = dirs[i]
    h = horiz(d)
    n = rng.randint(*TW['fan'])
    a0 = rng.uniform(0, 2 * math.pi)
    for j in range(n):
        ang = math.radians(rng.uniform(-TW['spread'], TW['spread']))
        hd = Vector((h.x * math.cos(ang) - h.y * math.sin(ang), h.x * math.sin(ang) + h.y * math.cos(ang), 0))
        e = math.radians(rng.uniform(*TW['rise']))
        dd = (hd * math.cos(e) + UP * math.sin(e) + d * 0.35).normalized()
        L = rng.uniform(*TW['len'])
        tip = pos[i] + dd * L
        if not fan_free(tip):
            continue
        mid = add_node(pos[i] + dd * L * 0.5 + UP * 0.015, i, dd, 0.0, K_SC, False)
        t1 = add_node(tip, mid, dd, 0.0, K_SC, False)
        if rng.random() < TW['second']:
            h2 = horiz(dd)
            for _ in range(2):
                ang2 = math.radians(rng.uniform(-TW['spread'], TW['spread']))
                hd2 = Vector((h2.x * math.cos(ang2) - h2.y * math.sin(ang2), h2.x * math.sin(ang2) + h2.y * math.cos(ang2), 0))
                d2 = (hd2 + UP * math.sin(math.radians(rng.uniform(*TW['rise'])))).normalized()
                q2 = tip + d2 * rng.uniform(*TW['len']) * 0.8
                if fan_free(q2):
                    add_node(q2, t1, d2, 0.0, K_SC, False)
N = len(pos)
print('tree nodes', N, '%.1fs' % (time.time() - T0))

# prune stubs: short leafy chains sprouting straight from heavy wood look epicormic
removed = [False] * N
for i in range(n_scaffold, N):
    if kids[i]:
        continue
    j, L = i, 0.0
    while par[j] >= 0 and kind[par[j]] == K_SC and len(kids[par[j]]) == 1:
        L += (pos[j] - pos[par[j]]).length
        j = par[j]
    base = par[j]
    if base >= 0 and kind[base] != K_SC and rspec[base] > 0.1 and L < 0.7:
        k = i
        while True:
            removed[k] = True
            if k == j:
                break
            k = par[k]
for i in range(N):
    kids[i] = [k for k in kids[i] if not removed[k]]
alive_nodes = [i for i in range(N) if not removed[i]]
print('pruned', sum(removed))

# smooth the colonised branches (keep scaffold as authored)
for _ in range(3):
    newp = {}
    for i in alive_nodes:
        if kind[i] != K_SC or not kids[i]:
            continue
        main = max(kids[i], key=lambda k: len(kids[k]) + 0.0)
        newp[i] = pos[i] * 0.5 + (pos[par[i]] + pos[main]) * 0.25
    for i, p in newp.items():
        pos[i] = p

# ------------------------------------------------------------------ radii (pipe model), subtree height
PIPE = P['pipe']
rad = [0.0] * N
hgt = [0.0] * N        # path distance to the farthest tip
ntip = [0] * N
for i in reversed(alive_nodes):
    if not kids[i]:
        r = PIPE['tip']
        ntip[i] = 1
    else:
        r = sum(rad[k] ** PIPE['exp'] for k in kids[i]) ** (1 / PIPE['exp'])
        hgt[i] = max(hgt[k] + (pos[k] - pos[i]).length for k in kids[i])
        ntip[i] = sum(ntip[k] for k in kids[i])
    rad[i] = max(r, rspec[i])
# limbs never thinner than what grows from them; smooth jumps along scaffold
for i in alive_nodes:
    if par[i] >= 0 and rad[i] > rad[par[i]]:
        rad[par[i]] = rad[i]
for i in reversed(alive_nodes):
    if par[i] >= 0:
        rad[par[i]] = max(rad[par[i]], rad[i])

# ------------------------------------------------------------------ growth schedule
G = P['growth']


def field(p, s, f):
    return 0.5 + 0.5 * noise.noise(p * f + Vector((s, s * 0.7, s * 1.3)))


zmin_c, zmax_c = C['rim'] - 1, C['top']
birth = [-9.0] * N
L_new = [0.0] * N
for i in alive_nodes:
    if kind[i] != K_SC:
        continue
    p = pos[i]
    L_new[i] = lerp(G['L_new'][0], G['L_new'][1], field(p, 2, 0.6))
    if hgt[i] < L_new[i]:
        hz = min(1.0, max(0.0, (p.z - zmin_c) / (zmax_c - zmin_c)))
        t0 = lerp(G['start'][0], G['start'][1], 0.55 * hz + 0.45 * field(p, 5, 0.25))
        birth[i] = t0 + (1 - hgt[i] / L_new[i]) * G['shoot']
for i in alive_nodes:      # a shoot is never older than what it grows from
    pp = par[i]
    if pp >= 0 and birth[pp] > -1 and birth[i] < birth[pp]:
        birth[i] = birth[pp] + 0.004

# ------------------------------------------------------------------ rosettes (leaf clusters at twig ends)
ckd = KDTree(len(clumps))
for i, cl in enumerate(clumps):
    ckd.insert(cl['c'], i)
ckd.balance()
rosettes = []
old_at = set()
for i in alive_nodes:
    if kids[i] or kind[i] != K_SC:
        continue
    d = (pos[i] - pos[par[i]]).normalized() if par[i] >= 0 else UP
    tE = max(birth[i], 0.02) + rng.uniform(*G['leaf_delay'])
    _, ci, _ = ckd.find(pos[i])
    rosettes.append(dict(pos=pos[i].copy(), dir=d, size=rng.uniform(0.85, 1.15), t=tE, old=-1.0, clump=ci, node=i))
    # last year's leaves: on the old wood where this shoot began
    j = i
    while par[j] >= 0 and birth[par[j]] > -1:
        j = par[j]
    b = par[j]
    if b >= 0 and b not in old_at and rng.random() < G['old_fraction']:
        old_at.add(b)
        db = (pos[b] - pos[par[b]]).normalized() if par[b] >= 0 else UP
        _, cb, _ = ckd.find(pos[b])
        rosettes.append(dict(pos=pos[b].copy(), dir=db, size=rng.uniform(0.75, 1.05), t=-1.0,
                             old=rng.uniform(*G['old_drop']), clump=cb, node=b))
print('rosettes', len(rosettes), 'old', len(old_at))

# canopy occlusion per rosette: march through a voxel grid of leaf density
VOX = 0.5
pts = np.array([[r['pos'].x, r['pos'].y, r['pos'].z] for r in rosettes], dtype=np.float32)
lo = pts.min(0) - 2
hi = pts.max(0) + 2
dims = np.ceil((hi - lo) / VOX).astype(int)
dens = np.zeros(dims, dtype=np.float32)
ix = ((pts - lo) / VOX).astype(int)
np.add.at(dens, (ix[:, 0], ix[:, 1], ix[:, 2]), 1.0)
dens = dens * 0.55
dirs_h = []
for k in range(24):     # cosine-weighted hemisphere (Fibonacci)
    t = (k + 0.5) / 24
    zc = math.sqrt(1 - t)
    rr = math.sqrt(t)
    ph = k * 2.39996
    dirs_h.append((rr * math.cos(ph), rr * math.sin(ph), zc))
vis = np.zeros(len(pts), dtype=np.float32)
for (dx, dy, dz) in dirs_h:
    od = np.zeros(len(pts), dtype=np.float32)
    for s in range(1, 26):
        q = pts + np.array([dx, dy, dz], dtype=np.float32) * (s * VOX * 0.9)
        qi = ((q - lo) / VOX).astype(int)
        ok = np.all((qi >= 0) & (qi < dims), axis=1)
        v = np.zeros(len(pts), dtype=np.float32)
        v[ok] = dens[qi[ok, 0], qi[ok, 1], qi[ok, 2]]
        od += v * 0.32
    vis += np.exp(-od)
vis /= len(dirs_h)
occ = 1 - vis
occ = np.clip((occ - np.percentile(occ, 3)) / (np.percentile(occ, 97) - np.percentile(occ, 3) + 1e-6), 0, 1)
print('occlusion done %.1fs' % (time.time() - T0))


def skeleton_preview(path):
    """Quick look-dev: front, side and top projections of wood and rosettes."""
    from PIL import Image, ImageDraw
    W, H, s = 900, 640, 26.0
    img = Image.new('RGB', (W * 3, H), (236, 232, 222))
    dr = ImageDraw.Draw(img)
    views = [(lambda p: (p.x, p.z), 0, 'front (x,z)'), (lambda p: (p.y, p.z), 1, 'side (y,z)'),
             (lambda p: (p.x, -p.y), 2, 'top (x,y)')]
    for f, k, name in views:
        ox, oy = W * k + W / 2, (H - 70) if k < 2 else H / 2
        pr = lambda p: (ox + f(p)[0] * s, oy - f(p)[1] * s)   # noqa: E731
        dr.line([(W * k, H - 70 - WATER * -s), (W * k + W, H - 70 - WATER * -s)], fill=(160, 170, 175)) if k < 2 else None
        for r, o in zip(rosettes, occ):
            x, y = pr(r['pos'])
            c = (170, 60, 30) if r['t'] < 0 else (int(40 + 60 * (1 - o)), int(90 + 90 * (1 - o)), 40)
            dr.ellipse([x - 2.5, y - 2.5, x + 2.5, y + 2.5], fill=c)
        for i in alive_nodes:
            if par[i] < 0:
                continue
            a, b = pr(pos[par[i]]), pr(pos[i])
            dr.line([a, b], fill=(52, 40, 30), width=max(1, int(rad[i] * s * 2)))
        dr.text((W * k + 12, 12), name, fill=(0, 0, 0))
    img.save(path)
    print('preview', path)


if '--skeleton' in sys.argv:
    skeleton_preview(os.path.join(BUILD, 'skeleton-%d.png' % P['seed']))
    sys.exit(0)

# ------------------------------------------------------------------ buttress roots over the granite
# Old Terminalia grow plank buttresses: tall, thin flanges that leave the
# trunk high up, drop to the ground and run on as roots that grip the rocks.
BUTTRESS = []
n_b = 7
for k in range(n_b):
    ang = k / n_b * 2 * math.pi + rng_isl.uniform(-0.22, 0.22)
    BUTTRESS.append(dict(az=ang, h0=rng_isl.uniform(1.5, 2.3), hr=rng_isl.uniform(0.45, 0.8), L=rng_isl.uniform(3.8, 6.0), w0=rng_isl.uniform(0.26, 0.36), ph=rng_isl.random() * 6))


def root_path(ang, h0, L, w0, ph, start_r=0.95, step=0.1, sub=False):
    """Points with (half-width, half-height) of a root running out from the trunk."""
    d = Vector((math.cos(ang), math.sin(ang), 0))
    side = Vector((-d.y, d.x, 0))
    pts = []
    s_ = 0.0
    while s_ <= L:
        t = s_ / L
        rho = start_r + s_
        q = d * rho + side * (math.sin(s_ * 0.85 + ph) * 0.38 * min(1.0, s_ / 1.2))
        g, _ = ground(q.x, q.y)
        w = lerp(w0, 0.04, t ** 0.75)
        H = h0 * math.exp(-s_ / 1.0) if not sub else 0.0       # the plank: tall near the trunk
        hh = max(w * 0.9, H * 0.5 + w * 0.5)
        z = g + hh * 0.5 - 0.02
        pts.append((Vector((q.x, q.y, z)), w, hh))
        s_ += step
    return pts


root_chains = []
for bt in BUTTRESS:
    main = root_path(bt['az'], bt['hr'], bt['L'], bt['w0'], bt['ph'], start_r=0.75)
    root_chains.append(main)
    # one or two side roots leave the main root and grip their own rocks
    for j in range(rng_isl.randint(1, 2)):
        i0 = int(len(main) * rng_isl.uniform(0.3, 0.55))
        p0, w_, _ = main[i0]
        da = rng_isl.choice((-1, 1)) * rng_isl.uniform(0.45, 0.85)
        ang2 = math.atan2(p0.y, p0.x) + da
        sub = root_path(ang2, 0, bt['L'] * rng_isl.uniform(0.4, 0.6), w_ * 0.75, bt['ph'] + 2, start_r=math.hypot(p0.x, p0.y), sub=True)
        sub.insert(0, (p0.copy(), w_ * 0.8, w_ * 0.8))
        root_chains.append(sub)
# small surface roots between the buttresses
for k in range(9):
    ang = rng_isl.uniform(0, 2 * math.pi)
    root_chains.append(root_path(ang, 0.25, rng_isl.uniform(1.8, 3.2), rng_isl.uniform(0.09, 0.15), rng_isl.random() * 6, start_r=1.0, sub=True))
for _ in range(33):   # keep the tree's stream where the art-directed build had it
    rng.random()


# ------------------------------------------------------------------ mesh
def flex_of(i):
    """wind weight: 0 on heavy wood, → 1 at fine outer twigs"""
    d = math.hypot(pos[i].x, pos[i].y)
    return max(0.0, min(1.0, (1 - min(1.0, rad[i] / 0.22)) ** 1.6 * (0.35 + 0.65 * min(1.0, d / 11))))


def trunk_profile(z, az):
    """Radius factor of the trunk at height z and world azimuth az: flutes that
    run down into the buttresses, a general flare, irregular lobes."""
    h = max(0.0, (z - P['trunk']['base']) / (P['trunk']['fork'] - P['trunk']['base']))
    lobes = (0.12 * math.cos(5 * az + 0.6) + 0.08 * math.cos(3 * az + 2.1) + 0.05 * math.cos(7 * az + 4.0))
    flute = 0.0
    for bt in BUTTRESS:
        da = math.atan2(math.sin(az - bt['az']), math.cos(az - bt['az']))
        reach = math.exp(-max(0.0, z - bt['h0'] * 0.55) * 1.6)
        flute += math.exp(-(da / 0.23) ** 2) * (0.55 + 0.9 * math.exp(-max(0.0, z) * 1.8)) * reach
    flare = math.exp(-h * 5.0)
    return 1.0 + lobes * (0.6 + flare) + 0.32 * flare + flute * 0.62


def build_chains():
    """Walk the graph: the heaviest child continues a tube; others start new ones."""
    chains = []
    stack = [(trunk_nodes[0], None)]
    while stack:
        start, from_parent = stack.pop()
        chain = [from_parent] if from_parent is not None else []
        i = start
        while True:
            chain.append(i)
            ks = sorted(kids[i], key=lambda k: -rad[k])
            if not ks:
                break
            for k in ks[1:]:
                stack.append((k, i))
            i = ks[0]
        chains.append(chain)
    return chains


def sides_for(r, k):
    if k == K_TRUNK:
        return 48
    if r > 0.3:
        return 26
    if r > 0.15:
        return 18
    if r > 0.07:
        return 12
    if r > 0.03:
        return 7
    if r > 0.012:
        return 5
    return 4


def build_mesh(chains):
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new('UVMap')
    col = bm.verts.layers.float_color.new('Col')
    lb = bm.verts.layers.float.new('_BIRTH')
    lr = bm.verts.layers.float.new('_RAD')
    TILE = P['bark_tile']

    def tube(points, radii, births, flexes, youth_of, kinds, prof=None):
        n = len(points)
        if n < 2:
            return
        T = []
        for i in range(n):
            a = points[max(0, i - 1)]
            b = points[min(n - 1, i + 1)]
            T.append((b - a).normalized() if (b - a).length > 1e-7 else UP)
        Nn = T[0].orthogonal().normalized()
        r_max = max(radii)
        sides = sides_for(r_max, kinds[1] if len(kinds) > 1 else kinds[0])
        rep_u = max(1, round(2 * math.pi * r_max / TILE)) if r_max > 0.02 else 1
        rings, vs, acc = [], [], 0.0
        for i in range(n):
            if i > 0:
                ax = T[i - 1].cross(T[i])
                if ax.length > 1e-6:
                    Nn = (Matrix.Rotation(T[i - 1].angle(T[i]), 3, ax.normalized()) @ Nn).normalized()
                acc += (points[i] - points[i - 1]).length
            vs.append(acc / TILE)
            Bv = T[i].cross(Nn).normalized()
            r = radii[i]
            ring = []
            for j in range(sides):
                th = 2 * math.pi * j / sides
                dirv = Nn * math.cos(th) + Bv * math.sin(th)
                kk = prof(points[i].z, math.atan2(dirv.y, dirv.x)) if prof else 1.0
                off = dirv * r * kk
                p = points[i] + off
                if r > 0.05:
                    p += dirv * r * (0.07 * noise.noise(p * 2.1 + Vector((r_max * 37, 0, 0)))
                                     + (0.08 * noise.noise(p * 0.8 + Vector((5.0, r_max * 11, 0))) if r > 0.25 else 0.0))
                v = bm.verts.new(p)
                v[col] = (1.0, flexes[i], youth_of(r), 1.0)
                v[lb] = births[i]
                v[lr] = (p - points[i]).length
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
        tipv = bm.verts.new(points[-1] + T[-1] * radii[-1] * 0.9)
        tipv[col] = (1.0, flexes[-1], youth_of(radii[-1]), 1.0)
        tipv[lb] = births[-1]
        tipv[lr] = radii[-1] * 0.9
        for j in range(sides):
            f = bm.faces.new((rings[-1][j], rings[-1][(j + 1) % sides], tipv))
            f.smooth = True
            for loop in f.loops:
                loop[uvl].uv = (0.5 * rep_u, vs[-1] + 0.05)

    def root_tube(chain):
        """Roots: sections are upright ellipses (tall planks near the trunk)."""
        n = len(chain)
        if n < 2:
            return
        sides = 14
        rings, vs, acc = [], [], 0.0
        for i, (p, w, hh) in enumerate(chain):
            a_ = chain[max(0, i - 1)][0]
            b_ = chain[min(n - 1, i + 1)][0]
            T = (b_ - a_).normalized()
            sd = T.cross(UP)
            sd = sd.normalized() if sd.length > 1e-5 else Vector((1, 0, 0))
            upv = T.cross(sd).normalized()      # (sd, upv, T) right-handed: faces point outward
            if i > 0:
                acc += (p - chain[i - 1][0]).length
            vs.append(acc / TILE)
            ring = []
            for j in range(sides):
                th = 2 * math.pi * j / sides
                q = p + sd * math.cos(th) * w + upv * math.sin(th) * hh
                q += (sd * math.cos(th) + upv * math.sin(th)) * w * 0.12 * noise.noise(q * 2.4)
                v = bm.verts.new(q)
                v[col] = (1.0, 0.0, 0.0, 1.0)
                v[lb] = -9.0
                v[lr] = 0.0
                ring.append(v)
            rings.append(ring)
        rep_u = max(1, round(2 * math.pi * chain[0][1] * 1.5 / TILE))
        for i in range(n - 1):
            a2, c2 = rings[i], rings[i + 1]
            for j in range(sides):
                j2 = (j + 1) % sides
                f = bm.faces.new((a2[j], a2[j2], c2[j2], c2[j]))
                f.smooth = True
                u0, u1 = rep_u * j / sides, rep_u * (j + 1) / sides
                for loop, uv in zip(f.loops, ((u0, vs[i]), (u1, vs[i]), (u1, vs[i + 1]), (u0, vs[i + 1]))):
                    loop[uvl].uv = uv
        tip = bm.verts.new(chain[-1][0] + (chain[-1][0] - chain[-2][0]).normalized() * chain[-1][1])
        tip[col] = (1.0, 0.0, 0.0, 1.0)
        tip[lb] = -9.0
        tip[lr] = 0.0
        for j in range(sides):
            f = bm.faces.new((rings[-1][j], rings[-1][(j + 1) % sides], tip))
            f.smooth = True
            for loop in f.loops:
                loop[uvl].uv = (0.5 * rep_u, vs[-1] + 0.05)

    youth = lambda r: max(0.0, min(1.0, 1 - (r - 0.01) / 0.08))   # noqa: E731
    n_tubes = 0
    for ch in chains:
        pts_ = [pos[i] for i in ch]
        rads = [rad[i] for i in ch]
        # a side branch starts inside its parent: its first ring is a little
        # narrower than the parent's there (no coincident rings at a fork)
        if ch[0] != trunk_nodes[0] and len(rads) > 1:
            rads[0] = min(rads[1] * 1.15, rad[ch[0]] * 0.82)
        # collar: a slight swelling where a branch leaves its parent
        if len(rads) > 2:
            rads[1] *= 1.12
        if len(rads) > 3:
            sm = rads[:]
            for _ in range(4):
                sm = [sm[0]] + [0.25 * sm[k - 1] + 0.5 * sm[k] + 0.25 * sm[k + 1] for k in range(1, len(sm) - 1)] + [sm[-1]]
            rads = [max(a, b) if k < 2 else b for k, (a, b) in enumerate(zip(rads, sm))]
        births = [birth[i] for i in ch]
        if births[0] > -1 and len(births) > 1:
            births[0] = births[1]
        flexes = [flex_of(i) for i in ch]
        kinds = [kind[i] for i in ch]
        prof = trunk_profile if ch[0] == trunk_nodes[0] else None
        tube(pts_, rads, births, flexes, youth, kinds, prof)
        n_tubes += 1
    for chain in root_chains:
        root_tube(chain)
    print('tubes', n_tubes)
    # growth data travels as a second UV set (TEXCOORD_1 = birth, ring radius);
    # the glTF exporter writes v as 1 - v, so store 1 - radius.
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
    bm = bmesh.new()
    R, S = 8.6, (0.11 if not QUICK else 0.2)
    N_ = int(2 * R / S)
    verts = {}
    for i in range(N_ + 1):
        for j in range(N_ + 1):
            x, y = -R + 2 * R * i / N_, -R + 2 * R * j / N_
            g, rock = ground(x, y)
            v = bm.verts.new((x, y, g))
            verts[i, j] = (v, rock)
    for i in range(N_):
        for j in range(N_):
            q = [verts[a] for a in ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))]
            if max(v.co.z for v, _ in q) < WATER - 0.6:
                continue
            f = bm.faces.new([v for v, _ in q])
            f.smooth = True
    n_ground = len(bm.verts)
    # the scholar's rock: Hainan Middle School's 太湖石 「虎踞龙盘」 stands by the
    # campus Terminalia; here it rises from the islet under the long limb
    tm = build_taihu()
    n_rock = tm['n_rock']
    bm.from_mesh(tm)
    bpy.data.meshes.remove(tm)
    me = bpy.data.meshes.new('island')
    bm.to_mesh(me)
    bm.free()
    rock = me.attributes.new('rock', 'FLOAT', 'POINT')
    taihu = me.attributes.new('taihu', 'FLOAT', 'POINT')
    for v in me.vertices:
        is_t = v.index >= n_ground
        rock.data[v.index].value = 1.0 if is_t else ground(v.co.x, v.co.y)[1]
        # 1 = the scholar's rock, 0.5 = its plinth, 0 = islet
        taihu.data[v.index].value = (1.0 if v.index < n_ground + n_rock else 0.5) if is_t else 0.0
    return me


# The scholar's rock in front of No. 1 Teaching Building, after the photograph
# in assets/images/campus/campus_taihushi.jpg (provided by the site's author):
# a long, recumbent grey limestone, honeycombed and pierced, a raised head on
# the left and a crest on the right, set on a dark stone plinth that carries
# the inscription 「虎踞龙盘」.
TAIHU = {'at': (-3.6, -2.55), 'yaw': math.radians(-14), 'length': 3.6, 'height': 1.38, 'depth': 1.2,
         'plinth': (3.9, 1.4, 0.5), 'seed': 19}


def build_taihu():
    r_ = random.Random(TAIHU['seed'])
    L, Hh, D = TAIHU['length'], TAIHU['height'], TAIHU['depth']
    px, py, pz = TAIHU['plinth']
    x0, y0 = TAIHU['at']
    g0, _ = ground(x0, y0)
    top = max(g0, WATER + 0.1) + pz * 0.55              # the plinth's top face (the rest is sunk)
    rot = Matrix.Rotation(TAIHU['yaw'], 4, 'Z')
    mb = bpy.data.metaballs.new('taihu')
    mb.resolution = 0.045
    mb.render_resolution = 0.045
    mb.threshold = 0.6
    ob = bpy.data.objects.new('TaihuMB', mb)
    bpy.context.scene.collection.objects.link(ob)

    def put(x, y, z, sx, sy, sz, neg=False, tilt=0.0):
        el = mb.elements.new()
        el.type = 'ELLIPSOID'
        el.radius = 1.0
        el.stiffness = 2.6 if neg else 1.4
        el.use_negative = neg
        q = rot @ Vector((x, y, 0))
        el.co = (x0 + q.x, y0 + q.y, z)
        el.size_x, el.size_y, el.size_z = sx, sy, sz
        el.rotation = (rot @ Matrix.Rotation(r_.uniform(-0.3, 0.3), 4, 'Z') @ Matrix.Rotation(tilt, 4, 'Y')).to_quaternion()

    # after the site photograph: a massive, rugged block over the left two thirds
    # whose broken top is roughly level; on the right it thins into a raised slab
    # that juts out to a point, its underside lifted off the plinth.
    # (u along the length, top and bottom in heights, depth in depths)
    prof = [(-0.5, 0.70, 0.0, 0.70), (-0.43, 0.93, 0.0, 0.92), (-0.34, 1.0, 0.0, 1.0), (-0.24, 0.96, 0.0, 1.0),
            (-0.13, 0.99, 0.0, 0.95), (-0.02, 0.92, 0.0, 0.9), (0.08, 0.86, 0.05, 0.82), (0.17, 0.78, 0.14, 0.7),
            (0.26, 0.74, 0.24, 0.6), (0.35, 0.72, 0.30, 0.5), (0.43, 0.7, 0.36, 0.42), (0.5, 0.68, 0.44, 0.3)]
    for (u, tk, bk, dk) in prof:
        zt, zb = Hh * tk, Hh * bk
        h = zt - zb
        put(u * L, r_.uniform(-0.05, 0.05), top + zb + h * 0.46, L * 0.13 * r_.uniform(0.9, 1.15), D * 0.8 * dk, h * 0.9,
            tilt=r_.uniform(-0.25, 0.25))
        for _ in range(2):     # rough knobs and blades along the top edge
            put(u * L + r_.uniform(-0.12, 0.12), r_.uniform(-0.25, 0.25) * D * dk, top + zt - r_.uniform(0.18, 0.3),
                r_.uniform(0.18, 0.32), r_.uniform(0.16, 0.26), r_.uniform(0.14, 0.24), tilt=r_.uniform(-0.6, 0.6))
    put(0.52 * L, 0.0, top + Hh * 0.58, 0.36, 0.2, 0.16, tilt=-0.35)     # the slab's tip
    # caves at the foot of the block (dark mouths, right through), then the
    # honeycomb (透、漏): hollows over the body, crowded on the block, some through
    for (u, hk, sz) in [(-0.33, 0.2, 0.3), (-0.12, 0.18, 0.26), (0.05, 0.3, 0.2)]:
        put(u * L, 0.0, top + Hh * hk, sz, D * 0.95, sz * 0.9, neg=True)
    for k in range(72):
        u = r_.uniform(-0.48, 0.4) if k % 3 else r_.uniform(-0.48, 0.05)
        hk = 0.15 + 0.75 * r_.random()
        through = k % 5 == 0
        side = r_.choice((-1, 1))
        sz = r_.uniform(0.06, 0.2) * (1.0 if r_.random() > 0.2 else 1.5)
        put(u * L, (0.0 if through else side * D * r_.uniform(0.38, 0.5)), top + Hh * hk * 0.95,
            sz * r_.uniform(0.8, 1.4), (D * 0.9 if through else sz * 1.3), sz * r_.uniform(0.7, 1.2), neg=True)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    bpy.data.objects.remove(ob)
    bpy.data.metaballs.remove(mb)
    for v in me.vertices:      # angular weathering (皱): sharp ridges, stepped facets, pits
        p = v.co
        rid = noise.ridged_multi_fractal(Vector((p.x * 1.7, p.y * 1.7, p.z * 1.3)), 0.9, 2.1, 4, 1.0, 2.2, noise_basis='PERLIN_ORIGINAL')
        fac = noise.noise(Vector((p.x * 3.2, p.y * 3.2, p.z * 2.4)) + Vector((5.0, 2.0, 1.0)))
        fac = math.copysign(abs(fac) ** 0.4, fac)          # plateaus with sharp steps between them
        pit = max(0.0, noise.noise(p * 8.0 + Vector((7.0, 1.0, 2.0))) - 0.2)
        d = 0.055 * (rid - 0.6) + 0.085 * fac - 0.09 * pit + 0.014 * noise.noise(p * 20.0)
        v.co = p + v.normal * d * (1 - 0.4 * max(0.0, v.normal.z))
        if v.co.z < top:
            v.co.z = top
    # the plinth: a dark granite block, slightly bevelled
    bm = bmesh.new()
    bm.from_mesh(me)
    n_rock = len(bm.verts)
    ret = bmesh.ops.create_cube(bm, size=1.0)
    for v in ret['verts']:
        q = rot @ Vector((v.co.x * px, v.co.y * py, 0))
        v.co = Vector((x0 + q.x, y0 + q.y, top - pz * (0.5 - v.co.z) - 0.25 * (0.5 - v.co.z)))
    bmesh.ops.bevel(bm, geom=list({e for v in ret['verts'] for e in v.link_edges}), offset=0.03, segments=2, affect='EDGES')
    me2 = bpy.data.meshes.new('taihu')
    bm.to_mesh(me2)
    bm.free()
    bpy.data.meshes.remove(me)
    for poly in me2.polygons:
        poly.use_smooth = True
    me2['n_rock'] = n_rock
    return me2


bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
chains = build_chains()
bark_me = build_mesh(chains)
bark = bpy.data.objects.new('LanrenBark', bark_me)
scene.collection.objects.link(bark)
isl_me = build_island()
island = bpy.data.objects.new('Island', isl_me)
scene.collection.objects.link(island)
print('bark verts', len(bark_me.vertices), 'island verts', len(isl_me.vertices), '%.1fs' % (time.time() - T0))
for me in (bark_me, isl_me):
    me.materials.append(bpy.data.materials.new('m_' + me.name))

# occluders for the AO bake: one disc per rosette stands in for its leaves
bmf = bmesh.new()
for r in rosettes:
    if r['t'] < 0:
        continue
    bmesh.ops.create_circle(bmf, cap_ends=True, segments=7, radius=0.26 * r['size'],
                            matrix=Matrix.Translation(r['pos'] + UP * 0.03))
fol_me = bpy.data.meshes.new('fol')
bmf.to_mesh(fol_me)
bmf.free()
fol = bpy.data.objects.new('BakeFoliage', fol_me)
scene.collection.objects.link(fol)

scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 12 if QUICK else 40
scene.world = bpy.data.worlds.new('w')
scene.world.light_settings.distance = 3.5


def bake_ao(ob):
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


bark_ao = bake_ao(bark)
colA = bark_me.color_attributes['Col']
for c, a in zip(colA.data, bark_ao):
    c.color = (a, c.color[1], c.color[2], 1.0)
bark_me.color_attributes.active_color = colA
bark_me.color_attributes.render_color_index = bark_me.color_attributes.active_color_index
print('bark AO %.1fs' % (time.time() - T0))

isl_ao = bake_ao(island)
icol = isl_me.color_attributes.new('Col', 'FLOAT_COLOR', 'POINT')
rk = isl_me.attributes['rock']
for v in isl_me.vertices:
    rock = max(rk.data[v.index].value, min(1.0, (1 - max(0.0, v.normal.z)) * 2.0))
    wet = max(0.0, min(1.0, 1 - (v.co.z - WATER) / 0.3))
    # alpha marks the scholar's rock (0) apart from the granite and soil (1)
    icol.data[v.index].color = (isl_ao[v.index], rock, wet, 1.0 - isl_me.attributes['taihu'].data[v.index].value)
isl_me.attributes.remove(isl_me.attributes['rock'])
isl_me.attributes.remove(isl_me.attributes['taihu'])
isl_me.color_attributes.active_color = icol
isl_me.color_attributes.render_color_index = isl_me.color_attributes.active_color_index
print('island AO %.1fs' % (time.time() - T0))

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

# rosettes.bin (three.js frame: x, z, −y), stride 16:
# pos3 dir3 size flex occ tEmerge tOldDrop rand clump3 shell
STRIDE = 16
crown_c = Vector((CX, CY, (C['rim'] + C['top']) * 0.5))
buf = bytearray()
for r, o in zip(rosettes, occ):
    p, d = r['pos'], r['dir']
    flex = flex_of(r['node'])
    c = clumps[r['clump']]['c']
    rn = math.hypot(p.x - CX, p.y - CY) / crown_R(math.atan2(p.y - CY, p.x - CX))
    shell = max(0.0, min(1.0, 1 - ((crown_top(min(rn, 1)) - p.z) / 3.0)))
    buf += struct.pack('<16f', p.x, p.z, -p.y, d.x, d.z, -d.y, r['size'], flex, float(o), r['t'], r['old'],
                       rng.random(), c.x, c.z, -c.y, shell)
with open(os.path.join(ASSETS, 'rosettes.bin'), 'wb') as fh:
    fh.write(buf)


def to3(v):
    return [round(v.x, 3), round(v.z, 3), round(-v.y, 3)]


new_ts = sorted(r['t'] for r in rosettes if r['t'] >= 0)
old_ts = sorted(r['old'] for r in rosettes if r['old'] > 0)
bx = [pos[i] for i in alive_nodes]
meta = {
    'generator': 'scripts/lanren/build_tree.py (v3: scaffold + space colonisation, clumped dome crown)',
    'blender': bpy.app.version_string, 'seed': P['seed'],
    'frame': 'three.js Y-up; tree base at origin; water plane at y = %.2f' % WATER,
    'water': WATER,
    'counts': {'nodes': len(alive_nodes), 'clumps': len(clumps), 'rosettes': len(rosettes),
               'oldRosettes': len(old_ts), 'barkVertices': len(bark_me.vertices),
               'islandVertices': len(isl_me.vertices)},
    'rosetteStride': STRIDE,
    'rosetteLayout': ['px', 'py', 'pz', 'dx', 'dy', 'dz', 'size', 'flex', 'occlusion', 'tEmerge', 'tOldDrop', 'rand',
                      'clumpX', 'clumpY', 'clumpZ', 'shell'],
    'growth': {'emergeRange': [round(new_ts[0], 3), round(new_ts[-1], 3)], 'emergeMedian': round(new_ts[len(new_ts) // 2], 3),
               'oldDropRange': [round(old_ts[0], 3), round(old_ts[-1], 3)]},
    'crown': {'centre': to3(crown_c), 'radius': C['R'], 'top': C['top'], 'rim': C['rim'],
              'bounds': {'min': to3(Vector((min(p.x for p in bx), min(p.y for p in bx), min(p.z for p in bx)))),
                         'max': to3(Vector((max(p.x for p in bx), max(p.y for p in bx), max(p.z for p in bx))))}},
    'anchors': {'trunk': to3(Vector((0.1, 0, 1.6))), 'fork': to3(pos[FORK]),
                'taihu': to3(Vector((TAIHU['at'][0], TAIHU['at'][1], max(ground(*TAIHU['at'])[0], WATER + 0.1) + TAIHU['plinth'][2] * 0.55 + TAIHU['height'] * 0.5))),
                'plinth': {'centre': to3(Vector((TAIHU['at'][0], TAIHU['at'][1], max(ground(*TAIHU['at'])[0], WATER + 0.1) + TAIHU['plinth'][2] * 0.55 - TAIHU['plinth'][2] * 0.5 + 0.1))),
                           'yaw': round(TAIHU['yaw'], 4), 'size': list(TAIHU['plinth'])},
                'limbDip': to3(pos[at(dragon, 0.62)]), 'limbEnd': to3(pos[dragon[-1]])},
    'params': {k: v for k, v in P.items() if k in ('crown', 'sc', 'pipe', 'growth')},
    'note': 'Species concept model of Terminalia catappa (open-grown, tiered). Not a survey of the campus tree.'
}
with open(os.path.join(ASSETS, 'tree.json'), 'w', encoding='utf-8') as fh:
    json.dump(meta, fh, ensure_ascii=False, indent=1, default=lambda o: round(o, 4) if isinstance(o, float) else str(o))
print(json.dumps(meta['counts']), meta['growth'], '%.1fs' % (time.time() - T0))
