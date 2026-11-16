"""HAIZ · 画风植物 — the stylized tree kit for the third-person campus walk.

Painted-background trees are masses, not leaves: a few soft clumps whose light
and shade read as whole volumes, with a leafy fringe at the edges. Each tree
here is a trunk plus clumps; every clump is a low dense blob (filling the gaps)
wrapped in alpha-tested leaf cards. All foliage normals point out of the crown's
own ellipsoid (blended with the clump's), so a crown shades as one volume with
lumps, as painters draw it, instead of as thousands of sparkling cards.

COLOR_0 on foliage: R = occlusion (crown interior and underside darker),
G = sway weight (0 at the trunk, 1 at the crown's outside), B = per-clump random
(hue variation), A = 1 on cards / 0 on the blob core. UVs point into
leaf-atlas.png (2×2 cells of leaf clusters; the centre of cell 0 is opaque).

Species follow assets/walk/campus.json (terminalia 榄仁, palm 椰子, chongyang 秋枫,
hongdou 红豆, banyan 榕, kapok 木棉, huoyan 凤凰木, fengling 风铃木, shrubs, botanic and
mixed planting). Forms are species concepts, not surveys of individual trees.

Run: python3 scripts/toon/build_trees.py   (PyPI bpy 5.x, or blender -b --python)
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
import bpy  # noqa: E402,I001
import bmesh  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Vector, noise  # noqa: E402
from common import ROOT, OUT, BUILD, reset, material, Builder, tube, ico, rounded_box, trs, export_glb, rng  # noqa: E402

reset(30)
BARK = material('Bark', '#6b5a4a', 0.9)
LEAF = material('Leaf', '#5f9a3e', 0.8)
STONE = material('Stone', '#9aa3a0', 0.9)
ATLAS_OPAQUE = (0.25, 0.25)        # centre of atlas cell 0


# ------------------------------------------------------------------ leaf atlas (grey shade + alpha)
def leaf_atlas(path, size=512, seed=7, scale=1.0, count=1.0, group=0.0):
    """scale: leaf size; count: leaves per cluster; group: 0 smooth value falloff … 1 painted value groups"""
    from PIL import Image, ImageDraw, ImageFilter
    r = rng(seed)
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    cell = size // 2
    for ci in range(4):
        ox, oy = (ci % 2) * cell, (ci // 2) * cell
        layer = Image.new('RGBA', (cell * 2, cell * 2), (0, 0, 0, 0))   # 2× supersampled
        d = ImageDraw.Draw(layer)
        S = cell * 2
        # opaque core so the blob's UVs (cell 0 centre) and dense centres never show holes
        d.ellipse([S * 0.30, S * 0.30, S * 0.70, S * 0.70], fill=(150, 150, 150, 255))
        n = int((300 if ci != 2 else 240) * count)
        lobes = [r.uniform(0, 2 * math.pi) for _ in range(3)]
        leaves = []
        for _ in range(n):
            a = r.uniform(0, 2 * math.pi)
            # an irregular, lobed silhouette: the edge radius wanders with the angle
            edge = 0.36 + 0.06 * sum(math.cos(2 * a + l) for l in lobes) / 3 + 0.03 * math.cos(5 * a + lobes[0])
            rad = (r.random() ** 0.6) * edge * S
            cx, cy = S / 2 + math.cos(a) * rad, S / 2 + math.sin(a) * rad
            leaves.append((cy, cx, a))
        leaves.sort()                      # draw top to bottom so upper leaves overlap the lower
        for cy, cx, a in leaves:
            L = S * r.uniform(0.075, 0.11) * (1.3 if ci == 2 else 1.0) * scale
            W = L * r.uniform(0.38, 0.5) * (0.6 if ci == 2 else 1.0)
            ang = a + r.uniform(-0.6, 0.6)
            # lit from the top left: value falls with y and with distance from the light
            shade = 0.55 + 0.45 * (1 - cy / S) * 0.8 + r.uniform(-0.12, 0.12)
            if group > 0:
                # painted value groups: a lit crown, a mid band, a shaded underside, little noise
                y = cy / S
                band = 1.0 if y < 0.42 else (0.8 if y < 0.62 else 0.62)
                shade = shade * (1 - group) + (band + r.uniform(-0.05, 0.05)) * group
            v = int(max(60, min(255, 255 * shade)))
            pts = []
            for k in range(12):
                t = k / 11
                x = (t - 0.5) * L
                w = math.sin(math.pi * t) ** 0.8 * W / 2
                pts.append((x, w))
            pts += [(x, -w) for x, w in reversed(pts)]
            ca, sa = math.cos(ang), math.sin(ang)
            poly = [(cx + x * ca - y * sa, cy + x * sa + y * ca) for x, y in pts]
            d.polygon(poly, fill=(v, v, v, 255))
            # a darker midrib stroke for a painted read
            d.line([(cx - L * 0.4 * ca, cy - L * 0.4 * sa), (cx + L * 0.4 * ca, cy + L * 0.4 * sa)], fill=(int(v * 0.8),) * 3 + (255,), width=2)
        layer = layer.resize((cell, cell), Image.LANCZOS)
        img.alpha_composite(layer, (ox, oy))
    img.save(path, optimize=True)


# ------------------------------------------------------------------ geometry helpers
def ellipsoid_normal(p, c, R):
    d = Vector(((p.x - c.x) / (R.x * R.x), (p.y - c.y) / (R.y * R.y), (p.z - c.z) / (R.z * R.z)))
    return d.normalized() if d.length > 1e-9 else Vector((0, 0, 1))


class Tree:
    def __init__(self, name, seed):
        self.name = name
        self.r = rng(seed)
        self.cr = rng(seed + 991)          # a separate stream, so per-card randoms never change the shapes
        self.trunk = Builder(name + '_trunk')
        self.leaf = Builder(name + '_leaf')
        self.clumps = []

    def limb(self, pts, radii, sides=8, sway0=0.0, sway1=0.15):
        n = len(pts)
        rings = []
        for i, (p, r) in enumerate(zip(pts, radii)):
            rings.append((p, (r, r), {}))
        base = len(self.trunk.verts)
        tube(self.trunk, rings, sides, BARK, cap0=False, cap1=True)
        # colour: R occlusion (darker low), G sway along the limb
        for vi in range(base, len(self.trunk.verts)):
            v = self.trunk.verts[vi]
            # nearest ring index → sway
            k = min(range(n), key=lambda i: (Vector(pts[i]) - v).length)
            s = sway0 + (sway1 - sway0) * (k / max(1, n - 1))
            ao = min(1.0, 0.55 + 0.45 * min(1.0, v.z / 3.0))
            self.trunk.colors[vi] = (ao, s, self.r.random(), 1.0)

    def clump(self, c, R, cards=None, card_size=None):
        self.clumps.append((Vector(c), Vector(R), cards, card_size))

    def finish(self, crown_c, crown_R, blob=0.8, density=1.0, sway_floor=0.25):
        crown_c, crown_R = Vector(crown_c), Vector(crown_R)
        for c, R, cards, card_size in self.clumps:
            hue = self.r.random()
            rmean = (R.x + R.y + R.z) / 3
            # occlusion: deeper inside the crown and lower down is darker
            def ao_of(p):
                q = Vector(((p.x - crown_c.x) / crown_R.x, (p.y - crown_c.y) / crown_R.y, (p.z - crown_c.z) / crown_R.z))
                out = min(1.0, q.length)
                under = max(0.0, -q.z)
                return max(0.15, min(1.0, 0.35 + 0.65 * out - 0.35 * under))

            def sway_of(p):
                q = Vector(((p.x - crown_c.x) / crown_R.x, (p.y - crown_c.y) / crown_R.y, (p.z - crown_c.z) / crown_R.z))
                return max(sway_floor, min(1.0, 0.35 + 0.65 * q.length))

            def nrm(p):
                a = ellipsoid_normal(p, crown_c, crown_R)
                b = (p - c).normalized()
                return (a * 0.65 + b * 0.35).normalized()

            # blob core: a lumpy icosphere
            bm = ico(2)
            seed = self.r.random() * 100
            for v in bm.verts:
                d = v.co.normalized()
                k = 1 + 0.18 * noise.noise(d * 2.2 + Vector((seed, 0, 0)))
                v.co = Vector((d.x * R.x * k, d.y * R.y * k, d.z * R.z * k)) * blob + c
            self.leaf.add_bm(bm, LEAF, color=lambda p: (ao_of(p) * 0.85, sway_of(p), hue, 0.0), normal_fn=nrm,
                             uv_fn=lambda p: ATLAS_OPAQUE)
            # leaf cards scattered over the clump's surface
            area = 4 * math.pi * rmean * rmean
            n = cards if cards is not None else max(6, int(area * 2.4 * density))
            size = card_size if card_size is not None else max(0.55, rmean * 0.95)
            verts, faces, cols, nors, uvs = [], [], [], [], []
            for _ in range(n):
                # point on the ellipsoid, biased to the upper and outer side (where light falls)
                while True:
                    d = Vector((self.r.gauss(0, 1), self.r.gauss(0, 1), self.r.gauss(0, 1) + 0.35)).normalized()
                    if self.r.random() < 0.55 + 0.45 * max(0, d.z):
                        break
                shell = self.r.uniform(0.82, 1.08)
                p = Vector((d.x * R.x, d.y * R.y, d.z * R.z)) * shell + c
                # card plane: facing out along d, rotated randomly about it
                t = d.cross(Vector((0, 0, 1)))
                if t.length < 1e-3:
                    t = Vector((1, 0, 0))
                t.normalize()
                bvec = d.cross(t).normalized()
                ang = self.r.uniform(0, 2 * math.pi)
                u = t * math.cos(ang) + bvec * math.sin(ang)
                w = d.cross(u).normalized()
                # tip the card towards the view plane a little (cards edge-on to the eye vanish)
                h = size * self.r.uniform(0.8, 1.25) / 2
                ci = self.r.randrange(4)
                u0, v0 = (ci % 2) * 0.5, (ci // 2) * 0.5
                base = len(verts)
                quad = [p - u * h - w * h, p + u * h - w * h, p + u * h + w * h, p - u * h + w * h]
                quv = [(u0, v0), (u0 + 0.5, v0), (u0 + 0.5, v0 + 0.5), (u0, v0 + 0.5)]
                card = 0.5 + 0.5 * self.cr.random()       # A: per-card random (> 0.5 marks a card)
                for q, uv in zip(quad, quv):
                    verts.append(q)
                    nors.append(nrm(q))
                    cols.append((ao_of(q), sway_of(q), hue, card))
                    uvs.append(uv)
                faces.append((base, base + 1, base + 2, base + 3))
            self.leaf.add(verts, faces, LEAF, None, cols, nors, uvs)

    def build(self):
        out = []
        if self.trunk.verts:
            t = self.trunk.build(smooth=True)
            out.append(t)
        if self.leaf.verts:
            lf = self.leaf.build(smooth=True)
            out.append(lf)
        return out


def bez(p0, p1, p2, n):
    return [tuple(Vector(p0) * (1 - t) ** 2 + Vector(p1) * 2 * (1 - t) * t + Vector(p2) * t * t) for t in (i / (n - 1) for i in range(n))]


# ------------------------------------------------------------------ species
def terminalia(name='terminalia', seed=11, scale=1.0, hero=False):
    """榄仁: a straight trunk carrying whorls of almost level branches; the crown is a
    stack of flat tiers with sky between them (the pagoda habit)."""
    T = Tree(name, seed)
    r = T.r
    if hero:
        # the hundred-year tree: a short buttressed trunk forking into level limbs, one long and low
        T.limb([(0, 0, -0.3), (0.05, 0, 1.2), (0.1, 0.05, 2.4), (0.12, 0.05, 3.1)], [1.05, 0.82, 0.72, 0.66], 12, 0, 0.02)
        for i in range(5):
            T.limb([(0.12 * math.cos(i), 0.12 * math.sin(i), -0.25), (0.9 * math.cos(i * 1.31), 0.9 * math.sin(i * 1.31), -0.6)],
                   [0.45, 0.18], 6, 0, 0)
        limbs = 8
        for i in range(limbs):
            a = 2 * math.pi * i / limbs + r.uniform(-0.2, 0.2)
            long_ = i == 0
            L = (12.5 if long_ else r.uniform(7.0, 9.5))
            rise = 0.9 if long_ else r.uniform(1.6, 4.0)
            z0 = 2.6 + r.uniform(0, 0.8)
            dx, dy = math.cos(a), math.sin(a)
            pts = bez((0.1, 0.05, z0), (dx * L * 0.35, dy * L * 0.35, z0 + rise * 1.4), (dx * L, dy * L, z0 + rise), 7)
            T.limb(pts, [0.42, 0.36, 0.3, 0.24, 0.18, 0.13, 0.09], 8, 0.02, 0.35)
            # clumps along the outer two thirds, a tier per limb
            for k, t in enumerate((0.45, 0.62, 0.78, 0.92, 1.03)):
                p = Vector(bez((0.1, 0.05, z0), (dx * L * 0.35, dy * L * 0.35, z0 + rise * 1.4), (dx * L, dy * L, z0 + rise), 21)[min(20, int(t * 20))])
                side = Vector((-dy, dx, 0)) * r.uniform(-1.2, 1.2)
                T.clump(p + side + Vector((0, 0, 0.6 + r.uniform(0, 0.5))), (r.uniform(1.9, 2.5), r.uniform(1.9, 2.5), r.uniform(0.85, 1.15)))
        # the upper tiers
        for z, R0, n in ((9.5, 6.5, 9), (11.7, 5.0, 7), (13.6, 3.2, 5), (15.0, 1.4, 2)):
            for i in range(n):
                a = 2 * math.pi * i / n + r.uniform(-0.3, 0.3)
                rr = R0 * r.uniform(0.55, 1.0)
                T.clump((math.cos(a) * rr, math.sin(a) * rr, z + r.uniform(-0.4, 0.4)), (r.uniform(1.8, 2.4), r.uniform(1.8, 2.4), r.uniform(0.8, 1.1)))
            T.limb([(0.1, 0.05, 3.0), (0.0, 0.0, z - 0.5)], [0.5, 0.2], 8, 0.02, 0.2)
        T.finish((0, 0, 8.5), (12.5, 12.5, 7.5), density=0.75)
        return T
    H = 8.6 * scale
    T.limb([(0, 0, -0.2), (0.05, 0.0, H * 0.5), (0.0, 0.05, H * 0.93)], [0.24 * scale, 0.17 * scale, 0.1 * scale], 8, 0, 0.12)
    tiers = [(0.37, 3.6, 6), (0.53, 3.25, 6), (0.68, 2.65, 5), (0.82, 1.9, 4), (0.95, 0.9, 2)]
    for zf, R0, n in tiers:
        z = H * zf
        a0 = r.uniform(0, 2 * math.pi)
        for i in range(n):
            a = a0 + 2 * math.pi * i / n + r.uniform(-0.25, 0.25)
            rr = R0 * scale * r.uniform(0.6, 0.95)
            tip = (math.cos(a) * rr, math.sin(a) * rr, z + 0.25 * scale)
            if R0 > 1:
                T.limb([(0, 0, z - 0.1), (tip[0] * 0.6, tip[1] * 0.6, z + 0.05), tip], [0.085 * scale, 0.06 * scale, 0.035 * scale], 5, 0.1, 0.5)
            cr = (1.25 if R0 > 1 else 0.95) * scale
            T.clump((tip[0], tip[1], tip[2] + 0.3 * scale), (cr * r.uniform(0.9, 1.15), cr * r.uniform(0.9, 1.15), cr * 0.5))
    T.finish((0, 0, H * 0.66), (3.9 * scale, 3.9 * scale, H * 0.42))
    return T


def round_tree(name, seed, H=7.2, crown=(3.3, 3.3, 2.7), n=15, trunk_r=0.26):
    """秋枫 / 红豆 / mixed planting: a forked trunk and a dense rounded dome."""
    T = Tree(name, seed)
    r = T.r
    cz = H - crown[2] * 0.9
    T.limb([(0, 0, -0.2), (0.0, 0.05, 1.4), (0.05, 0.0, 2.4)], [trunk_r, trunk_r * 0.85, trunk_r * 0.75], 8, 0, 0.05)
    for i in range(3):
        a = 2 * math.pi * i / 3 + r.uniform(-0.3, 0.3)
        tip = (math.cos(a) * crown[0] * 0.45, math.sin(a) * crown[1] * 0.45, cz + r.uniform(0, 0.8))
        T.limb(bez((0.03, 0.02, 2.3), (math.cos(a) * 0.5, math.sin(a) * 0.5, 3.2), tip, 5), [trunk_r * 0.7, trunk_r * 0.55, trunk_r * 0.42, trunk_r * 0.3, trunk_r * 0.2], 6, 0.05, 0.4)
    pts = []
    tries = 0
    while len(pts) < n and tries < 4000:
        tries += 1
        d = Vector((r.gauss(0, 1), r.gauss(0, 1), r.gauss(0, 1) * 0.9 + 0.25)).normalized()
        p = Vector((d.x * crown[0], d.y * crown[1], d.z * crown[2])) * r.uniform(0.45, 0.78) + Vector((0, 0, cz))
        if all((p - q).length > 1.45 for q in pts):
            pts.append(p)
    for p in pts:
        s = r.uniform(1.3, 1.75)
        T.clump(p, (s, s, s * 0.82))
    T.finish((0, 0, cz), (crown[0] * 1.05, crown[1] * 1.05, crown[2] * 1.05))
    return T


def banyan(name='banyan', seed=31):
    """榕: a thick trunk, long spreading limbs, a wide low crown and hanging aerial roots."""
    T = Tree(name, seed)
    r = T.r
    T.limb([(0, 0, -0.3), (0.05, 0, 1.2), (0.1, 0.0, 2.3)], [0.55, 0.45, 0.4], 10, 0, 0.03)
    for i in range(6):
        T.limb([(0.3 * math.cos(i), 0.3 * math.sin(i), -0.2), (1.1 * math.cos(i * 1.1), 1.1 * math.sin(i * 1.1), -0.5)], [0.28, 0.1], 6, 0, 0)
    tips = []
    for i in range(6):
        a = 2 * math.pi * i / 6 + r.uniform(-0.25, 0.25)
        L = r.uniform(4.0, 5.2)
        tip = (math.cos(a) * L, math.sin(a) * L, 4.4 + r.uniform(-0.3, 0.5))
        T.limb(bez((0.1, 0, 2.2), (math.cos(a) * 1.5, math.sin(a) * 1.5, 3.8), tip, 6), [0.3, 0.25, 0.2, 0.15, 0.11, 0.08], 7, 0.03, 0.4)
        tips.append(tip)
        # aerial roots from the limb down to the ground
        for k in range(2):
            t = r.uniform(0.45, 0.85)
            p = Vector(bez((0.1, 0, 2.2), (math.cos(a) * 1.5, math.sin(a) * 1.5, 3.8), tip, 11)[int(t * 10)])
            T.limb([tuple(p), (p.x + r.uniform(-0.1, 0.1), p.y + r.uniform(-0.1, 0.1), p.z * 0.5), (p.x, p.y, -0.3)], [0.03, 0.035, 0.05], 4, 0.3, 0.05)
    pts = []
    tries = 0
    while len(pts) < 22 and tries < 5000:
        tries += 1
        d = Vector((r.gauss(0, 1), r.gauss(0, 1), r.gauss(0, 0.6) + 0.35)).normalized()
        p = Vector((d.x * 5.6, d.y * 5.6, d.z * 2.2)) * r.uniform(0.5, 0.85) + Vector((0, 0, 5.2))
        if all((p - q).length > 1.6 for q in pts):
            pts.append(p)
    for p in pts:
        s = r.uniform(1.45, 1.9)
        T.clump(p, (s, s, s * 0.75))
    T.finish((0, 0, 5.2), (6.2, 6.2, 2.8))
    return T


def kapok(name='kapok', seed=41):
    """木棉: a tall, straight, buttressed trunk with whorls of horizontal branches and a sparse crown."""
    T = Tree(name, seed)
    r = T.r
    T.limb([(0, 0, -0.3), (0, 0, 0.8), (0.03, 0, 6), (0.05, 0.03, 12.2)], [0.55, 0.38, 0.26, 0.1], 10, 0, 0.1)
    for i in range(5):
        a = 2 * math.pi * i / 5
        T.limb([(0.2 * math.cos(a), 0.2 * math.sin(a), 1.0), (0.85 * math.cos(a), 0.85 * math.sin(a), -0.3)], [0.12, 0.25], 4, 0, 0)
    for z, L, n in ((6.0, 3.6, 4), (8.0, 3.0, 4), (9.8, 2.3, 3), (11.4, 1.4, 3)):
        a0 = r.uniform(0, 6.28)
        for i in range(n):
            a = a0 + 2 * math.pi * i / n
            tip = (math.cos(a) * L, math.sin(a) * L, z + 0.5)
            T.limb([(0, 0, z), (tip[0] * 0.6, tip[1] * 0.6, z + 0.15), tip], [0.11, 0.07, 0.04], 5, 0.1, 0.5)
            T.clump((tip[0], tip[1], tip[2] + 0.35), (1.15, 1.15, 0.75))
            T.clump((tip[0] * 0.55, tip[1] * 0.55, tip[2] + 0.2), (0.85, 0.85, 0.55))
    T.clump((0, 0, 12.6), (1.0, 1.0, 0.8))
    T.finish((0, 0, 9.0), (3.9, 3.9, 4.0), density=0.9)
    return T


def umbrella(name='umbrella', seed=51):
    """凤凰木 / 风铃木: limbs rising and spreading into a broad, flat-topped crown."""
    T = Tree(name, seed)
    r = T.r
    T.limb([(0, 0, -0.2), (0.05, 0, 1.4), (0.08, 0.02, 2.6)], [0.3, 0.25, 0.22], 8, 0, 0.04)
    for i in range(5):
        a = 2 * math.pi * i / 5 + r.uniform(-0.3, 0.3)
        tip = (math.cos(a) * 3.8, math.sin(a) * 3.8, 5.4 + r.uniform(-0.2, 0.3))
        T.limb(bez((0.08, 0.02, 2.5), (math.cos(a) * 1.0, math.sin(a) * 1.0, 4.6), tip, 6), [0.19, 0.16, 0.12, 0.09, 0.07, 0.05], 6, 0.04, 0.45)
    pts = []
    tries = 0
    while len(pts) < 17 and tries < 5000:
        tries += 1
        a, rr = r.uniform(0, 6.28), math.sqrt(r.random()) * 4.6
        p = Vector((math.cos(a) * rr, math.sin(a) * rr, 5.9 + r.uniform(-0.35, 0.45) - 0.08 * rr))
        if all((p - q).length > 1.5 for q in pts):
            pts.append(p)
    for p in pts:
        s = r.uniform(1.35, 1.7)
        T.clump(p, (s, s, s * 0.5))
    T.finish((0, 0, 5.6), (5.4, 5.4, 1.7), density=1.0)
    return T


def shrub(name='shrub', seed=61):
    T = Tree(name, seed)
    r = T.r
    for i in range(6):
        a = 2 * math.pi * i / 6 + r.uniform(-0.4, 0.4)
        rr = r.uniform(0.3, 0.7)
        s = r.uniform(0.5, 0.7)
        T.clump((math.cos(a) * rr, math.sin(a) * rr, s * 0.75 + r.uniform(0, 0.2)), (s, s, s * 0.8), card_size=0.55)
    T.clump((0, 0, 1.0), (0.6, 0.6, 0.5), card_size=0.55)
    T.finish((0, 0, 0.7), (1.3, 1.3, 0.9), blob=0.85, density=1.6, sway_floor=0.1)
    return T


def palm(name='palm', seed=71):
    """椰子: a leaning ringed trunk and a crown of arching fronds with drooping leaflets."""
    T = Tree(name, seed)
    r = T.r
    H = 9.0
    lean = Vector((0.9, 0.2, 0))
    pts = [tuple(Vector((0, 0, -0.2)) + lean * (t * t) + Vector((0, 0, H * t))) for t in (i / 8 for i in range(9))]
    radii = [0.22, 0.2, 0.18, 0.17, 0.165, 0.16, 0.155, 0.15, 0.17]
    T.limb(pts, radii, 9, 0, 0.12)
    # ring bands: alternate occlusion along the trunk
    for vi in range(len(T.trunk.verts)):
        v = T.trunk.verts[vi]
        band = 0.82 + 0.18 * (0.5 + 0.5 * math.sin(v.z * 9.0))
        c = T.trunk.colors[vi]
        T.trunk.colors[vi] = (c[0] * band, c[1], c[2], 1.0)
    top = Vector(pts[-1])
    # coconuts
    for i in range(5):
        a = 2 * math.pi * i / 5
        T.trunk.add_bm(ico(1), BARK, color=(0.45, 0.12, 0.9, 1.0), xform=trs(top + Vector((math.cos(a) * 0.22, math.sin(a) * 0.22, -0.25)), (0, 0, 0), (0.15, 0.15, 0.17)))
    verts, faces, cols, nors, uvs = [], [], [], [], []
    fronds = 15
    for i in range(fronds):
        a = 2 * math.pi * i / fronds + r.uniform(-0.15, 0.15)
        el = r.uniform(-0.1, 0.85) if i % 2 else r.uniform(0.3, 1.0)
        L = r.uniform(3.6, 4.6)
        d = Vector((math.cos(a) * math.cos(el), math.sin(a) * math.cos(el), math.sin(el)))
        side = Vector((-math.sin(a), math.cos(a), 0))
        hue = r.random()
        # rachis: a ballistic arch
        N = 14
        rach = []
        for k in range(N):
            t = k / (N - 1)
            p = top + d * (L * t) + Vector((0, 0, -1.9 * (t ** 2) * (0.6 + 0.4 * math.cos(el))))
            rach.append(p)
        for k in range(1, N):
            t = k / (N - 1)
            p, q = rach[k - 1], rach[k]
            fwd = (q - p).normalized()
            for sgn in (1, -1):
                ll = (0.25 + 0.95 * math.sin(math.pi * min(1, t * 1.1)) ** 0.7) * (1 - 0.35 * t)
                down = Vector((0, 0, -1))
                lv = (side * sgn * 0.75 + down * 0.55 + fwd * 0.25).normalized()
                w = 0.07 * (1 - 0.5 * t)
                base = len(verts)
                a0, a1 = p, q
                b0 = a0 + lv * ll
                quad = [a0, a1, b0 + fwd * 0.06, b0 - fwd * w]
                for qv in quad:
                    verts.append(qv)
                    nn = (Vector((0, 0, 1)) * 0.6 + (qv - top).normalized() * 0.4).normalized()
                    nors.append(nn)
                    cols.append((min(1.0, 0.55 + 0.45 * t), min(1.0, 0.3 + 0.7 * t), hue, 0.0))
                    uvs.append(ATLAS_OPAQUE)
                faces.append((base, base + 1, base + 2, base + 3))
        # the rachis itself, a thin strip
        for k in range(N - 1):
            p, q = rach[k], rach[k + 1]
            base = len(verts)
            wv = Vector((0, 0, 0.04))
            for qv in (p - wv, q - wv, q + wv, p + wv):
                verts.append(qv)
                nors.append((Vector((0, 0, 1)) * 0.6 + d * 0.4).normalized())
                cols.append((0.7, 0.3 + 0.7 * k / N, hue, 0.0))
                uvs.append(ATLAS_OPAQUE)
            faces.append((base, base + 1, base + 2, base + 3))
    T.leaf.add(verts, faces, LEAF, None, cols, nors, uvs)
    return T


def taihu_rock(name='taihu'):
    """太湖石 on its plinth: a perforated, wrinkled stone (a concept, not a scan of the campus rock)."""
    bpy.ops.object.select_all(action='DESELECT')
    me = bpy.data.meshes.new(name)
    bm = ico(4)
    for v in bm.verts:
        d = v.co.normalized()
        n = noise.fractal(d * 1.6 + Vector((3.1, 0, 0)), 0.6, 2.2, 4)
        k = 1 + 0.32 * n + 0.08 * noise.noise(d * 7)
        v.co = Vector((d.x * 1.55 * k, d.y * 0.85 * k, d.z * 2.1 * k)) + Vector((0, 0, 2.15))
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    holes = []
    for i, (p, s) in enumerate((((0.2, 0, 3.1), 0.42), ((-0.5, 0.1, 1.9), 0.36), ((0.6, -0.1, 1.5), 0.3), ((-0.1, 0.0, 2.6), 0.28))):
        hm = bpy.data.meshes.new('hole%d' % i)
        hb = ico(2)
        bmesh.ops.scale(hb, vec=Vector((s, 1.6, s * 1.2)), verts=hb.verts)
        bmesh.ops.translate(hb, vec=Vector(p), verts=hb.verts)
        hb.to_mesh(hm)
        hb.free()
        ho = bpy.data.objects.new('hole%d' % i, hm)
        bpy.context.scene.collection.objects.link(ho)
        holes.append(ho)
        m = ob.modifiers.new('b%d' % i, 'BOOLEAN')
        m.operation = 'DIFFERENCE'
        m.object = ho
        m.solver = 'EXACT'
    dg = bpy.context.evaluated_depsgraph_get()
    baked = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    for h in holes:
        bpy.data.objects.remove(h)
    bpy.data.objects.remove(ob)
    b = Builder(name)
    verts = [v.co.copy() for v in baked.vertices]
    faces = [tuple(p.vertices) for p in baked.polygons]
    cols = []
    for v in verts:
        ao = max(0.35, min(1.0, 0.45 + 0.55 * (v.z / 4.2) + 0.15 * noise.noise(v * 2.0)))
        cols.append((ao, 0.0, 0.5, 1.0))
    b.add(verts, faces, STONE, None, cols)
    b.add_bm(rounded_box((4.6, 3.0, 0.55), 0.08, 2), STONE, color=(0.8, 0.0, 0.2, 1.0), xform=trs((0, 0, 0.0)))
    return b.build(smooth=True)


# ------------------------------------------------------------------ build all
atlas = os.path.join(OUT, 'leaf-atlas.png')
leaf_atlas(atlas)
# V2: larger leaves in painted value groups, so a crown reads as brush marks, not grain
leaf_atlas(os.path.join(ROOT, 'lanren', 'assets', 'stroll', 'leaf-atlas-v2.png'), scale=1.7, count=0.42, group=0.75, seed=11)
print('wrote', atlas)

kit = [
    terminalia('terminalia', 11), terminalia('terminalia_b', 12, 0.85),
    round_tree('round', 21), round_tree('round_b', 22, H=6.0, crown=(2.8, 2.8, 2.3), n=12, trunk_r=0.2),
    banyan(), kapok(), umbrella(), shrub(), palm(), palm('palm_b', 72),
    terminalia('lanshu', 2611, hero=True),
]
objects = []
stats = {}
for T in kit:
    obs = T.build()
    for o in obs:
        o['tree'] = T.name
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in obs)
    stats[T.name] = tris
    objects += obs
rock = taihu_rock()
objects.append(rock)
stats['taihu'] = sum(len(p.vertices) - 2 for p in rock.data.polygons)
print('triangles', stats)
raw = os.path.join(BUILD, 'flora-raw.glb')
export_glb(raw, objects, animations=False)
print('wrote', raw)
