"""Build the world of 《春天没有收件人》 in Blender (bpy 5.3, run as a Python module).

    /home/user/bpyenv/bin/python world/build_world.py      -> assets/world.blend, assets/world.glb

One continuous place, laid out in metres (Blender Z-up; X east, Y north):

  * a three-storey school building whose west wall rises straight out of a river;
    the hero classroom is on the ground floor, its three west windows open onto water
  * the river (x -35..-6) flows north–south; its bed hides a running track
  * downstream (north) an empty station whose track bed is the river, nameboard blank
  * upstream (south) a low slab footbridge — the third branch of the fork "有一 → 条/个/座"

Geometry is grouped by lightmap ("bake groups"). Every face is routed to a group, so the
hero room gets its own dense lightmap while the rest of the building shares another.
Dynamic objects (glass, curtains, clock hands, the opening sash, the key, the letter) are
exported separately and are not baked.
"""
import json
import math
import pathlib
import random
import sys

import bpy
import bmesh
from mathutils import Matrix, Vector

ROOT = pathlib.Path(__file__).resolve().parent.parent
TEX = ROOT / "assets" / "tex"
sys.path.insert(0, str(ROOT / "world"))

# ------------------------------------------------------------------ materials
# tex: texture prefix in assets/tex; tile: metres per texture repeat; tint: linear multiplier
# col: flat linear colour when no texture; unit: object supplies 0..1 UVs; emit: emission
MATS = {
    "plaster":    dict(tex="plaster", tile=2.0, rough=0.9),
    "ceiling":    dict(tex="plaster", tile=2.0, rough=0.92, tint=(1.0, 1.0, 1.0)),
    "paintgreen": dict(tex="paintgreen", tile=2.0, rough=0.35),
    "terrazzo":   dict(tex="terrazzo", tile=1.0, rough=0.45),
    "wood":       dict(tex="wood", tile=1.2, rough=0.45),
    "door":       dict(tex="wood", tile=1.2, rough=0.5, tint=(0.42, 0.20, 0.14)),
    "metal_blue": dict(tex="metal", tile=1.0, rough=0.45, tint=(0.11, 0.21, 0.30)),
    "metal_win":  dict(tex="metal", tile=1.0, rough=0.5, tint=(0.24, 0.34, 0.30)),
    "metal_grey": dict(tex="metal", tile=1.0, rough=0.5, tint=(0.36, 0.38, 0.38)),
    "metal_dark": dict(tex="metal", tile=1.0, rough=0.5, tint=(0.05, 0.05, 0.05)),
    "whitepaint": dict(tex="metal", tile=1.0, rough=0.5, tint=(0.80, 0.80, 0.76)),
    "chalkboard": dict(tex="chalkboard", unit=True, rough=0.8),
    "concrete":   dict(tex="concrete", tile=2.0, rough=0.88),
    "platform":   dict(tex="concrete", tile=2.0, rough=0.85, tint=(1.05, 1.03, 1.0)),
    "facade":     dict(tex="facade", tile=3.0, rough=0.9, tint=(1.0, 0.86, 0.68)),
    "band":       dict(tex="concrete", tile=2.0, rough=0.88, tint=(0.95, 0.95, 0.95)),
    "stone":      dict(tex="stone", tile=2.0, rough=0.75),
    "corr":       dict(tex="corr", tile=1.0, rough=0.55),
    "grass":      dict(tex="grass", tile=4.0, rough=0.95),
    "track":      dict(tex="track", tile=1.0, rough=0.9),
    "turf":       dict(tex="grass", tile=4.0, rough=0.95, tint=(0.75, 1.0, 0.7)),
    "paper":      dict(tex="paper", tile=0.3, rough=0.9),
    "sign":       dict(tex="sign", unit=True, rough=0.6),
    "timetable":  dict(tex="timetable", unit=True, rough=0.9),
    "clock":      dict(tex="clock", unit=True, rough=0.3),
    "tactile":    dict(tex="concrete", tile=2.0, rough=0.7, tint=(1.3, 0.85, 0.12)),
    "whiteline":  dict(tex="concrete", tile=2.0, rough=0.7, tint=(1.5, 1.5, 1.45)),
    "mud":        dict(tex="concrete", tile=2.0, rough=1.0, tint=(0.22, 0.20, 0.15)),
    "book_r":     dict(col=(0.42, 0.06, 0.05), rough=0.7),
    "book_b":     dict(col=(0.05, 0.12, 0.30), rough=0.7),
    "book_g":     dict(col=(0.10, 0.25, 0.12), rough=0.7),
    "book_w":     dict(col=(0.70, 0.66, 0.58), rough=0.8),
    "book_y":     dict(col=(0.70, 0.50, 0.12), rough=0.7),
    "black":      dict(col=(0.02, 0.02, 0.02), rough=0.6),
    "brass":      dict(col=(0.62, 0.45, 0.20), rough=0.35, metal=1.0),
    "tube":       dict(col=(0.85, 0.85, 0.85), rough=0.3),
    "lampglow":   dict(col=(0.9, 0.85, 0.7), rough=0.5, emit=(1.0, 0.82, 0.55)),
    "darkroom":   dict(tex="plaster", tile=2.0, rough=0.9, tint=(0.5, 0.5, 0.5)),
    "curtain":    dict(tex="fabric", tile=0.5, rough=0.95, tint=(0.85, 0.85, 0.8)),
    "glass":      dict(col=(0.8, 0.85, 0.85), rough=0.05),
}


def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


# --------------------------------------------------------------- mesh builder
class Group:
    def __init__(self, name, lightmap=0, dynamic=False):
        self.name, self.lightmap, self.dynamic = name, lightmap, dynamic
        self.faces = []  # (pts[list of Vector], mat, uvs or None, smooth)

    def add(self, pts, mat, uvs=None, smooth=False):
        assert mat in MATS, mat
        self.faces.append(([Vector(p) for p in pts], mat, uvs, smooth))


GROUPS = {}
ROUTES = []  # (predicate(centroid, normal), group name)


def group(name, lightmap=0, dynamic=False):
    if name not in GROUPS:
        GROUPS[name] = Group(name, lightmap, dynamic)
    return GROUPS[name]


def face_normal(pts):
    n = Vector((0, 0, 0))
    for i in range(len(pts)):
        a, b = pts[i], pts[(i + 1) % len(pts)]
        n.x += (a.y - b.y) * (a.z + b.z)
        n.y += (a.z - b.z) * (a.x + b.x)
        n.z += (a.x - b.x) * (a.y + b.y)
    return n.normalized() if n.length > 1e-12 else Vector((0, 0, 1))


def emit(gname, pts, mat, uvs=None, smooth=False):
    pts = [Vector(p) for p in pts]
    c = sum(pts, Vector()) / len(pts)
    n = face_normal(pts)
    g = gname
    if not GROUPS[gname].dynamic:
        for pred, target in ROUTES:
            if pred(c, n):
                g = target
                break
    GROUPS[g].add(pts, mat, uvs, smooth)


FACE_KEYS = ("+x", "-x", "+y", "-y", "+z", "-z")


def box(g, x0, x1, y0, y1, z0, z1, mat, M=None, skip=()):
    """Axis-aligned box (optionally transformed by matrix M). mat: str or {face: mat, 'all': mat}."""
    F = {
        "+x": [(x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1)],
        "-x": [(x0, y1, z0), (x0, y0, z0), (x0, y0, z1), (x0, y1, z1)],
        "+y": [(x1, y1, z0), (x0, y1, z0), (x0, y1, z1), (x1, y1, z1)],
        "-y": [(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)],
        "+z": [(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)],
        "-z": [(x0, y1, z0), (x1, y1, z0), (x1, y0, z0), (x0, y0, z0)],
    }
    for k in FACE_KEYS:
        if k in skip:
            continue
        m = mat if isinstance(mat, str) else mat.get(k, mat.get("all"))
        if m is None:
            continue
        pts = [Vector(p) for p in F[k]]
        if M is not None:
            pts = [M @ p for p in pts]
        emit(g, pts, m)


def cyl(g, p0, p1, r, mat, seg=12, caps=True, r1=None):
    p0, p1 = Vector(p0), Vector(p1)
    r1 = r if r1 is None else r1
    ax = (p1 - p0).normalized()
    t = Vector((1, 0, 0)) if abs(ax.x) < 0.9 else Vector((0, 1, 0))
    u = ax.cross(t).normalized()
    v = ax.cross(u)
    ring0 = [p0 + (u * math.cos(2 * math.pi * i / seg) + v * math.sin(2 * math.pi * i / seg)) * r for i in range(seg)]
    ring1 = [p1 + (u * math.cos(2 * math.pi * i / seg) + v * math.sin(2 * math.pi * i / seg)) * r1 for i in range(seg)]
    for i in range(seg):
        j = (i + 1) % seg
        emit(g, [ring0[i], ring0[j], ring1[j], ring1[i]], mat, smooth=True)
    if caps:
        emit(g, list(reversed(ring0)), mat)
        emit(g, ring1, mat)


def quad_unit(g, pts, mat, flip_u=False):
    uvs = [(0, 0), (1, 0), (1, 1), (0, 1)]
    if flip_u:
        uvs = [(1 - a, b) for a, b in uvs]
    emit(g, pts, mat, uvs)


def rotz(a, cx=0.0, cy=0.0, cz=0.0):
    return Matrix.Translation((cx, cy, cz)) @ Matrix.Rotation(a, 4, "Z") @ Matrix.Translation((-cx, -cy, -cz))


# -------------------------------------------------------------------- layout
XW, XWI = -6.0, -5.76        # west exterior face / classroom inner face
XEC, XEC2 = 1.5, 1.74        # classroom east wall (corridor side)
XCOR, XCOR2 = 4.5, 4.8       # corridor outer line (columns / parapet)
YN, YS = 24.0, -24.0
FLOORS = [(1.0, 4.4), (4.6, 8.0), (8.2, 11.6)]
BAYS = [(-23.76, -15.48, 2), (-15.24, -5.24, 3), (-5.0, 5.0, 3), (5.24, 15.24, 3), (15.48, 23.76, 2)]
CROSS = [(-24.0, -23.76), (-15.48, -15.24), (-5.24, -5.0), (5.0, 5.24), (15.24, 15.48), (23.76, 24.0)]
HERO = dict(x0=XWI, x1=XEC, y0=-5.0, y1=5.0, z0=1.0, z1=4.4)
DADO = 1.2  # height of green paint band

rng = random.Random(7)


def in_hero(c, n, pad=0.012):
    return (HERO["x0"] - 0.245 < c.x < HERO["x1"] + 0.12 and HERO["y0"] - pad < c.y < HERO["y1"] + pad
            and HERO["z0"] - pad < c.z < HERO["z1"] + pad
            and not (n.x < -0.9 and c.x < XW + 0.01))   # exterior face of west wall stays on the facade


def windows_for_bay(y0, y1, k):
    c = (y0 + y1) / 2
    return [c - 3.3, c, c + 3.3] if k == 3 else [c - 2.1, c + 2.1]


def wall_with_openings_x(g, xa, xb, ya, yb, f, ceil, openings, inner_sign, outer_mat):
    """Wall slab between x=xa..xb spanning y ya..yb, floor f..ceil, with rectangular openings
    [(y0,y1,z0,z1)]. Inner face material follows the dado line; inner side is inner_sign (+1: +x)."""
    # vertical cut lines
    zs = sorted({f, f + DADO, ceil} | {z for o in openings for z in (o[2], o[3])})
    ys = sorted({ya, yb} | {y for o in openings for y in (o[0], o[1])})
    for i in range(len(ys) - 1):
        for j in range(len(zs) - 1):
            cy, cz = (ys[i] + ys[i + 1]) / 2, (zs[j] + zs[j + 1]) / 2
            if any(o[0] < cy < o[1] and o[2] < cz < o[3] for o in openings):
                continue
            inner = "paintgreen" if cz < f + DADO else "plaster"
            mats = {"all": "plaster", ("+x" if inner_sign > 0 else "-x"): inner, ("-x" if inner_sign > 0 else "+x"): outer_mat}
            # faces against neighbouring cells are interior: skip them unless they border an opening
            skip = []
            if j > 0 and not any(o[0] < cy < o[1] and o[2] < zs[j] - 1e-4 < o[3] for o in openings):
                skip.append("-z")
            if j < len(zs) - 2 and not any(o[0] < cy < o[1] and o[2] < zs[j + 1] + 1e-4 < o[3] for o in openings):
                skip.append("+z")
            if i > 0 and not any(o[0] < ys[i] - 1e-4 < o[1] and o[2] < cz < o[3] for o in openings):
                skip.append("-y")
            if i < len(ys) - 2 and not any(o[0] < ys[i + 1] + 1e-4 < o[1] and o[2] < cz < o[3] for o in openings):
                skip.append("+y")
            # sill tops read as terrazzo boards
            if any(o[0] < cy < o[1] and abs(o[2] - zs[j + 1]) < 1e-4 for o in openings):
                mats["+z"] = "terrazzo" if inner_sign > 0 else "plaster"
            box(g, xa, xb, ys[i], ys[i + 1], zs[j], zs[j + 1], mats, skip=skip)


def steel_window(g, x, y0, y1, z0, z1, depth=0.06, exclude=None, glass_group="glass", name_tag=""):
    """Old steel casement window: 3 columns, lower 3 rows of panes, top transom row."""
    fw, mw = 0.045, 0.022
    xa, xb = x - depth / 2, x + depth / 2
    W = y1 - y0
    zt = z0 + (z1 - z0) * 0.74
    cols = [y0 + W * k / 3 for k in range(4)]
    # outer frame
    box(g, xa, xb, y0, y1, z0, z0 + fw, "metal_win")
    box(g, xa, xb, y0, y1, z1 - fw, z1, "metal_win")
    box(g, xa, xb, y0, y0 + fw, z0, z1, "metal_win")
    box(g, xa, xb, y1 - fw, y1, z0, z1, "metal_win")
    box(g, xa - 0.005, xb + 0.005, y0, y1, zt - fw / 2, zt + fw / 2, "metal_win")
    for k in (1, 2):
        box(g, xa, xb, cols[k] - fw / 2, cols[k] + fw / 2, z0, z1, "metal_win")
    panes = []
    for k in range(3):
        ca, cb = cols[k] + (fw / 2 if k else fw), cols[k + 1] - (fw / 2 if k < 2 else fw)
        if exclude is not None and k == exclude:
            panes.append((ca, cb, zt + fw / 2, z1 - fw))
            continue
        rows = [z0 + fw, z0 + fw + (zt - fw / 2 - z0 - fw) / 3, z0 + fw + 2 * (zt - fw / 2 - z0 - fw) / 3, zt - fw / 2]
        for r in (1, 2):
            box(g, xa + 0.01, xb - 0.01, ca, cb, rows[r] - mw / 2, rows[r] + mw / 2, "metal_win")
        mid = (ca + cb) / 2
        box(g, xa + 0.01, xb - 0.01, mid - mw / 2, mid + mw / 2, z0 + fw, zt - fw / 2, "metal_win")
        panes.append((ca, cb, z0 + fw, zt - fw / 2))
        panes.append((ca, cb, zt + fw / 2, z1 - fw))
    for (ca, cb, za, zb) in panes:
        emit(glass_group, [(x, ca, za), (x, cb, za), (x, cb, zb), (x, ca, zb)], "glass")
    return cols


def opening_sash(gname, x, ya, yb, za, zb):
    """The one window sash that opens (hinged at ya). Built around its hinge at origin later."""
    fw, mw, d = 0.035, 0.02, 0.05
    box(gname, -d / 2, d / 2, 0, yb - ya, 0, fw, "metal_win")
    box(gname, -d / 2, d / 2, 0, yb - ya, zb - za - fw, zb - za, "metal_win")
    box(gname, -d / 2, d / 2, 0, fw, 0, zb - za, "metal_win")
    box(gname, -d / 2, d / 2, yb - ya - fw, yb - ya, 0, zb - za, "metal_win")
    h = zb - za
    for r in (1, 2):
        box(gname, -d / 2 + 0.01, d / 2 - 0.01, fw, yb - ya - fw, h * r / 3 - mw / 2, h * r / 3 + mw / 2, "metal_win")
    m = (yb - ya) / 2
    box(gname, -d / 2 + 0.01, d / 2 - 0.01, m - mw / 2, m + mw / 2, fw, h - fw, "metal_win")
    emit("sash_glass", [(0, fw, fw), (0, yb - ya - fw, fw), (0, yb - ya - fw, h - fw), (0, fw, h - fw)], "glass")


def build_building():
    g = "bldg"
    # stone plinth rising from the river bed, ground-floor slab on top
    box(g, XW - 0.12, XCOR2, YS - 0.12, YN + 0.12, -2.8, 0.6, {"all": "stone", "+z": None})
    for (fz, cz) in FLOORS:
        # floor slabs, split per bay so the hero floor is one clean face
        slab0 = fz - 0.4 if fz < 2 else fz - 0.2
        for (y0, y1, _) in BAYS:
            box(g, XWI, XEC, y0, y1, slab0, fz, {"all": "concrete", "+z": "terrazzo", "-z": "ceiling" if fz > 2 else None})
        for (y0, y1) in CROSS:
            box(g, XWI, XEC, y0, y1, slab0, fz, {"all": "concrete", "-z": "ceiling" if fz > 2 else None}, skip=("+z",))
        box(g, XEC, XCOR2, YS, YN, slab0, fz, {"all": "concrete", "+z": "terrazzo", "-z": "ceiling" if fz > 2 else None})
        # exterior floor band on the west face
        box(g, XW - 0.05, XWI, YS, YN, slab0, fz, {"all": "band"}, skip=("+x",))
        # roof slab over the top storey
        if cz > 11:
            top = cz + 0.25
            for (y0, y1, _) in BAYS:
                box(g, XWI, XEC, y0, y1, cz, top, {"all": "concrete", "-z": "ceiling"})
            for (y0, y1) in CROSS:
                box(g, XWI, XEC, y0, y1, cz, top, {"all": "concrete"}, skip=("-z",))
            box(g, XEC, XCOR2, YS, YN, cz, top, {"all": "concrete", "-z": "ceiling"})
            box(g, XW - 0.05, XWI, YS, YN, cz, top, "band", skip=("+x",))
        # west wall per bay with windows
        for bi, (y0, y1, k) in enumerate(BAYS):
            ops = [(c - 1.2, c + 1.2, fz + 0.9, fz + 3.0) for c in windows_for_bay(y0, y1, k)]
            wall_with_openings_x(g, XW, XWI, y0, y1, fz, cz, ops, +1, "facade")
            for (oa, ob, za, zb) in ops:
                hero_mid = fz < 2 and abs((oa + ob) / 2) < 0.01
                steel_window(g, XW + 0.08, oa, ob, za, zb, exclude=1 if hero_mid else None)
                # exterior sill ledge
                box(g, XW - 0.10, XW + 0.02, oa - 0.08, ob + 0.08, za - 0.09, za - 0.02, "band")
                # curtains drawn in a few windows of other rooms (seen from outside)
                if not (fz < 2 and bi == 2) and rng.random() < 0.4:
                    side = rng.choice([0, 1])
                    w = rng.uniform(0.5, 1.4)
                    ya, yb = (oa, oa + w) if side == 0 else (ob - w, ob)
                    emit(g, [(XWI + 0.15, yb, za + 0.05), (XWI + 0.15, ya, za + 0.05), (XWI + 0.15, ya, zb), (XWI + 0.15, yb, zb)], "curtain")
            # dark back walls of other rooms so the glass never shows daylight through
        for (y0, y1) in CROSS:
            box(g, XW, XEC, y0, y1, fz, cz, {"all": "plaster", "-x": "facade"})
        # classroom east walls: high windows + two doors per bay
        for (y0, y1, k) in BAYS:
            c = (y0 + y1) / 2
            ops = [(c - 2.8, c - 0.4, fz + 1.9, fz + 3.0), (c + 0.4, c + 2.8, fz + 1.9, fz + 3.0),
                   (y1 - 1.5, y1 - 0.5, fz, fz + 2.2), (y0 + 0.5, y0 + 1.5, fz, fz + 2.2)]
            wall_with_openings_x(g, XEC, XEC2, y0, y1, fz, cz, ops, -1, "plaster")
            for (oa, ob, za, zb) in ops[:2]:
                steel_window(g, (XEC + XEC2) / 2, oa, ob, za, zb, depth=0.05)
            # doors: front door ajar (hinged at north jamb), back door shut with a small light
            if fz < 2 and y0 == -5.0:
                M = rotz(math.radians(-62), XEC2 - 0.02, y1 - 0.5)
                box(g, XEC2 - 0.06, XEC2 - 0.02, y1 - 1.5, y1 - 0.5, fz, fz + 2.18, "door", M=M)
            else:
                box(g, XEC + 0.08, XEC + 0.12, y1 - 1.5, y1 - 0.5, fz, fz + 2.18, "door")
            box(g, XEC + 0.08, XEC + 0.12, y0 + 0.5, y0 + 1.5, fz, fz + 2.18, "door")
            # dark linings for the non-hero rooms' far walls (keeps their interiors closed)
        # corridor: columns and parapet on the east line
        for yc in [YS + 0.15 + i * 4.0 for i in range(13)]:
            if yc > YN:
                break
            box(g, XCOR, XCOR2, yc - 0.15, yc + 0.15, fz, cz, "facade")
        box(g, XCOR, XCOR + 0.22, YS, YN, fz, fz + 1.05, {"all": "facade", "-x": "plaster"})
        box(g, XCOR - 0.03, XCOR + 0.25, YS, YN, fz + 1.05, fz + 1.12, "band")
        # end walls (north faces the station, south faces the bridge)
        for (ya, yb, sgn) in ((YS, YS + 0.24, -1), (YN - 0.24, YN, 1)):
            ops = [(-3.3, -1.0, fz + 0.9, fz + 3.0)]
            zs = [fz, fz + 0.9, fz + 3.0, cz]
            for j in range(3):
                za, zb = zs[j], zs[j + 1]
                if j == 1:
                    box(g, XW, -3.3, ya, yb, za, zb, {"all": "facade", ("-y" if sgn > 0 else "+y"): "plaster"})
                    box(g, -1.0, XEC2, ya, yb, za, zb, {"all": "facade", ("-y" if sgn > 0 else "+y"): "plaster"})
                else:
                    box(g, XW, XEC2, ya, yb, za, zb, {"all": "facade", ("-y" if sgn > 0 else "+y"): "plaster"})
            # rotate the steel window into the XZ plane: build it along y then swap axes
            yy = (ya + yb) / 2
            fwm = 0.045
            box(g, -3.3, -1.0, yy - 0.03, yy + 0.03, fz + 0.9, fz + 0.9 + fwm, "metal_win")
            box(g, -3.3, -1.0, yy - 0.03, yy + 0.03, fz + 3.0 - fwm, fz + 3.0, "metal_win")
            for xm in (-3.3, -2.53, -1.77, -1.0 - fwm):
                box(g, xm, xm + fwm, yy - 0.03, yy + 0.03, fz + 0.9, fz + 3.0, "metal_win")
            box(g, -3.3, -1.0, yy - 0.035, yy + 0.035, fz + 2.45, fz + 2.45 + fwm, "metal_win")
            emit("glass", [(-3.3, yy, fz + 0.95), (-1.0, yy, fz + 0.95), (-1.0, yy, fz + 2.95), (-3.3, yy, fz + 2.95)], "glass")
            box(g, -3.4, -0.9, yb if sgn > 0 else ya - 0.1, (yb + 0.1) if sgn > 0 else ya, fz + 0.81, fz + 0.88, "band")
    # roof: parapet, coping, water tank
    rz = FLOORS[-1][1] + 0.25
    for (xa, xb, ya, yb) in ((XW - 0.05, XCOR2, YS - 0.05, YS + 0.2), (XW - 0.05, XCOR2, YN - 0.2, YN + 0.05),
                             (XW - 0.05, XW + 0.2, YS, YN), (XCOR2 - 0.25, XCOR2, YS, YN)):
        box(g, xa, xb, ya, yb, rz, rz + 0.9, "facade")
        box(g, xa - 0.03, xb + 0.03, ya - 0.03, yb + 0.03, rz + 0.9, rz + 0.98, "band")
    box(g, -1.0, 2.6, 12.0, 16.0, rz, rz + 1.9, "concrete")
    box(g, -1.0, 2.6, 12.0, 16.0, rz + 1.9, rz + 2.0, "band")
    # downpipes on the west face
    for yp in (-23.6, 23.6, -10.25, 10.25):
        cyl(g, (XW - 0.12, yp, -0.2), (XW - 0.12, yp, rz + 0.6), 0.055, "metal_grey", seg=10)
    # an old air-conditioner box under one upper window
    box(g, XW - 0.45, XW, 8.6, 9.5, 5.1, 5.65, {"all": "whitepaint"})
    box(g, XW - 0.36, XW, -12.4, -11.6, 8.7, 9.2, {"all": "whitepaint"})


def build_hero_room():
    g = "furn"
    x0, x1, y0, y1, f, c = HERO["x0"], HERO["x1"], HERO["y0"], HERO["y1"], HERO["z0"], HERO["z1"]
    cx = (x0 + x1) / 2
    # teacher's platform and desk
    box(g, x0, x1, 3.5, y1, f, f + 0.2, {"all": "concrete", "+z": "terrazzo"})
    box(g, cx - 0.6, cx + 0.6, 4.0, 4.6, f + 0.2, f + 1.15, {"all": "door", "+z": "wood"})
    # blackboard with frame and chalk ledge
    bx0, bx1, bz0, bz1, by = cx - 2.0, cx + 2.0, 2.05, 3.25, y1 - 0.012
    quad_unit(g, [(bx0, by, bz0), (bx1, by, bz0), (bx1, by, bz1), (bx0, by, bz1)], "chalkboard")
    box(g, bx0 - 0.05, bx0, y1 - 0.04, y1, bz0 - 0.05, bz1 + 0.05, "metal_grey")
    box(g, bx1, bx1 + 0.05, y1 - 0.04, y1, bz0 - 0.05, bz1 + 0.05, "metal_grey")
    box(g, bx0, bx1, y1 - 0.04, y1, bz1, bz1 + 0.05, "metal_grey")
    box(g, bx0 - 0.05, bx1 + 0.05, y1 - 0.11, y1, bz0 - 0.06, bz0, "metal_grey")
    for i in range(5):
        xx = bx0 + 0.4 + rng.random() * 3.2
        box(g, xx, xx + 0.07, y1 - 0.09, y1 - 0.08 + 0.012, bz0, bz0 + 0.011, "book_w", M=rotz(rng.random(), xx, y1 - 0.08, 0))
    # wall clock above the board; hands are dynamic
    ccz = 3.72
    cyl(g, (cx, y1, ccz), (cx, y1 - 0.05, ccz), 0.175, "black", seg=32)
    quad_unit(g, [(cx - 0.15, y1 - 0.056, ccz - 0.15), (cx + 0.15, y1 - 0.056, ccz - 0.15), (cx + 0.15, y1 - 0.056, ccz + 0.15), (cx - 0.15, y1 - 0.056, ccz + 0.15)], "clock")
    # loudspeaker box
    box(g, x1 - 1.1, x1 - 0.7, y1 - 0.2, y1, 3.75, 4.05, {"all": "door"})
    # back board (黑板报)
    quad_unit(g, [(x1 - 0.9, y0 + 0.012, 2.0), (x0 + 0.8, y0 + 0.012, 2.0), (x0 + 0.8, y0 + 0.012, 3.4), (x1 - 0.9, y0 + 0.012, 3.4)], "chalkboard")
    # timetable near the front door
    quad_unit(g, [(x1 - 0.005, 3.1, 2.4), (x1 - 0.005, 2.55, 2.4), (x1 - 0.005, 2.55, 3.13), (x1 - 0.005, 3.1, 3.13)], "timetable", flip_u=False)
    # desks and chairs (students face north, windows on their left)
    cols = [-4.76, -3.01, -1.26, 0.49]
    rows = [2.6, 1.6, 0.6, -0.4, -1.4, -2.4, -3.4]
    for ri, yc in enumerate(rows):
        for ci, xc in enumerate(cols):
            a = math.radians(rng.uniform(-1.5, 1.5))
            dx, dy = rng.uniform(-0.03, 0.03), rng.uniform(-0.04, 0.04)
            desk(g, xc + dx, yc + dy, a, f)
            for s in (-0.3, 0.3):
                pull = rng.uniform(0.0, 0.18)
                ca = math.radians(rng.gauss(0, 6))
                if ri == 2 and ci == 0 and s < 0:
                    pull, ca = 0.32, math.radians(-25)   # the window seat, pushed back
                chair(g, xc + dx + s + rng.uniform(-0.03, 0.03), yc + dy - 0.42 - pull, ca, f)
            books_on_desk(g, xc + dx, yc + dy, a, f)
    # ceiling lights (off) and two fans
    for yy in (-2.8, 0.0, 2.8):
        for xx in (cx - 1.8, cx + 1.8):
            for s in (-0.5, 0.5):
                cyl(g, (xx, yy + s, c), (xx, yy + s, c - 0.55), 0.006, "metal_grey", seg=6, caps=False)
            box(g, xx - 0.06, xx + 0.06, yy - 0.64, yy + 0.64, c - 0.62, c - 0.55, "whitepaint")
            cyl(g, (xx, yy - 0.6, c - 0.645), (xx, yy + 0.6, c - 0.645), 0.013, "tube", seg=10)
    for yy in (-1.7, 1.7):
        cyl(g, (cx, yy, c), (cx, yy, c - 0.55), 0.016, "whitepaint", seg=10)
        cyl(g, (cx, yy, c - 0.55), (cx, yy, c - 0.70), 0.11, "whitepaint", seg=20)
        for k in range(3):
            a = math.radians(20 + k * 120)
            M = Matrix.Translation((cx, yy, 0)) @ Matrix.Rotation(a, 4, "Z")
            box(g, 0.12, 0.66, -0.055, 0.055, c - 0.66, c - 0.65, "whitepaint", M=M)
    # broom, bucket in the back corner
    cyl(g, (x1 - 0.25, y0 + 0.2, f), (x1 - 0.22, y0 + 0.18, f + 1.3), 0.012, "wood", seg=8)
    cyl(g, (x1 - 0.55, y0 + 0.3, f), (x1 - 0.55, y0 + 0.3, f + 0.3), 0.14, "metal_grey", seg=20, r1=0.16)
    # window boards (水磨石窗台) projecting into the room
    for wc in (-3.3, 0.0, 3.3):
        box(g, x0 - 0.01, x0 + 0.1, wc - 1.3, wc + 1.3, 1.86, 1.9, "terrazzo")
    # curtain rods
    for wc in (-3.3, 0.0, 3.3):
        cyl(g, (x0 + 0.1, wc - 1.55, 4.15), (x0 + 0.1, wc + 1.55, 4.15), 0.012, "metal_grey", seg=8)


def desk(g, xc, yc, a, f):
    M = rotz(a, xc, yc, 0)
    top = f + 0.76
    box(g, xc - 0.6, xc + 0.6, yc - 0.25, yc + 0.25, top - 0.025, top, {"all": "wood"}, M=M)
    # book shelf under the top
    box(g, xc - 0.57, xc + 0.57, yc - 0.2, yc + 0.22, top - 0.15, top - 0.14, "metal_blue", M=M)
    box(g, xc - 0.57, xc + 0.57, yc + 0.2, yc + 0.22, top - 0.15, top - 0.025, "metal_blue", M=M)
    for sx in (-0.57, 0.555):
        box(g, xc + sx, xc + sx + 0.015, yc - 0.2, yc + 0.22, top - 0.15, top - 0.025, "metal_blue", M=M)
    for sx in (-0.56, 0.535):
        for sy in (-0.22, 0.195):
            box(g, xc + sx, xc + sx + 0.025, yc + sy, yc + sy + 0.025, f, top - 0.025, "metal_blue", M=M)
    for sy in (-0.22, 0.195):
        box(g, xc - 0.56, xc + 0.56, yc + sy, yc + sy + 0.02, f + 0.12, f + 0.14, "metal_blue", M=M)


def chair(g, xc, yc, a, f):
    M = rotz(a, xc, yc, 0)
    sz = f + 0.44
    box(g, xc - 0.19, xc + 0.19, yc - 0.17, yc + 0.17, sz - 0.02, sz, "wood", M=M)
    box(g, xc - 0.19, xc + 0.19, yc - 0.2, yc - 0.185, sz + 0.24, sz + 0.34, "wood", M=M)
    for sx in (-0.17, 0.15):
        for sy in (-0.16, 0.14):
            box(g, xc + sx, xc + sx + 0.02, yc + sy, yc + sy + 0.02, f, sz - 0.02, "metal_blue", M=M)
        box(g, xc + sx, xc + sx + 0.02, yc - 0.2, yc - 0.18, sz - 0.02, sz + 0.34, "metal_blue", M=M)
    box(g, xc - 0.17, xc + 0.17, yc - 0.16, yc - 0.14, f + 0.1, f + 0.12, "metal_blue", M=M)


BOOKMATS = ["book_r", "book_b", "book_g", "book_w", "book_y", "book_w", "paper"]


def books_on_desk(g, xc, yc, a, f):
    M = rotz(a, xc, yc, 0)
    top = f + 0.76
    r = rng.random()
    if r < 0.55:
        n = rng.randint(1, 4)
        bx, by = xc + rng.uniform(-0.5, 0.3), yc + rng.uniform(-0.05, 0.08)
        z = top
        ang = rng.uniform(-0.3, 0.3)
        for _ in range(n):
            t = rng.uniform(0.008, 0.025)
            w, d = rng.uniform(0.17, 0.21), rng.uniform(0.24, 0.27)
            Mb = M @ rotz(ang + rng.uniform(-0.12, 0.12), bx, by, 0)
            box(g, bx - w / 2, bx + w / 2, by - d / 2, by + d / 2, z, z + t, rng.choice(BOOKMATS), M=Mb)
            z += t
    # books stuffed in the shelf
    for _ in range(rng.randint(0, 5)):
        bx = xc + rng.uniform(-0.5, 0.45)
        w = rng.uniform(0.02, 0.06)
        box(g, bx, bx + w, yc - 0.15, yc + 0.18, top - 0.14, top - 0.14 + rng.uniform(0.07, 0.1), rng.choice(BOOKMATS), M=M)


def build_dynamic():
    """Objects animated or shaded specially in Three.js (not baked)."""
    x0, y1 = HERO["x0"], HERO["y1"]
    cx = (HERO["x0"] + HERO["x1"]) / 2
    # opening sash of the hero middle window (built at hinge origin; placed in Three.js)
    opening_sash("sash", 0, 0.0, 0.755, 0.0, 1.486)
    # clock hands, pivot at origin, pointing +z (12 o'clock) in local space
    box("hand_h", -0.006, 0.006, -0.004, 0.004, -0.02, 0.085, "black")
    box("hand_m", -0.004, 0.004, -0.004, 0.004, -0.025, 0.125, "black")
    box("hand_s", -0.0015, 0.0015, -0.003, 0.003, -0.03, 0.135, "book_r")
    # the key, lying on the middle window sill (built at origin)
    k = "key"
    cyl(k, (0, 0, 0), (0, 0, 0.003), 0.016, "brass", seg=20)
    box(k, 0.014, 0.075, -0.0035, 0.0035, 0, 0.003, "brass")
    box(k, 0.055, 0.062, -0.012, 0.0, 0, 0.003, "brass")
    box(k, 0.066, 0.075, -0.010, 0.0, 0, 0.003, "brass")
    # the letter: an envelope and a half-opened folded sheet (built at origin, on +z)
    box("letter", -0.11, 0.11, -0.055, 0.055, 0, 0.002, "paper")
    lt = "letter_sheet"
    nu, nv = 10, 8
    for i in range(nu):
        for j in range(nv):
            u0, u1, v0, v1 = i / nu, (i + 1) / nu, j / nv, (j + 1) / nv
            def P(u, v):
                return (-0.105 + u * 0.21, -0.07 + v * 0.14, 0.004)
            emit(lt, [P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)], "paper", uvs=[(u0, v0), (u1, v0), (u1, v1), (u0, v1)])
    # curtains: six bunched panels, gridded so the wind can move them (local origin at rod top)
    for ci in range(6):
        name = f"curtain_{ci}"
        W, H, nu, nv = 0.55, 2.2, 22, 26
        for i in range(nu):
            for j in range(nv):
                u0, u1, v0, v1 = i / nu, (i + 1) / nu, j / nv, (j + 1) / nv
                def P(u, v):
                    fold = math.sin(u * math.pi * 7) * 0.045 * (0.75 + 0.25 * v)
                    return (fold, u * W, -H + v * H)
                emit(name, [P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)], "curtain",
                     uvs=[(u0 * W / 0.5, v0 * H / 0.5), (u1 * W / 0.5, v0 * H / 0.5), (u1 * W / 0.5, v1 * H / 0.5), (u0 * W / 0.5, v1 * H / 0.5)], smooth=True)


def build_banks():
    g = "land"
    # east bank: paved walk by the water, then soil; continues past the building both ways
    for (ya, yb, gg) in ((-130.0, YS, g), (YN, 150.0, g), (-4000.0, -130.0, "far"), (150.0, 4000.0, "far")):
        box(gg, XW, -2.5, ya, yb, -2.8, 1.0, {"all": "concrete", "+z": "platform", "-x": "concrete"}, skip=("-y", "+y", "-z"))
        box(gg, -2.5, 80.0, ya, yb, -2.8, 1.0, {"all": "concrete", "+z": "grass"}, skip=("-x", "-y", "+y", "-z"))
    box(g, XCOR2, 80.0, YS, YN, -2.8, 1.0, {"all": "concrete", "+z": "grass"})
    box(g, XCOR2, 22.0, YS, YN, 1.0, 1.02, {"all": "concrete", "+z": "platform"})
    # school boundary wall beyond the corridor
    box(g, 22.0, 22.3, -60.0, 34.0, 1.0, 3.2, {"all": "facade"})
    # river bed and the sunken playground in front of the school
    box("bed", -36.0, XW, -4000.0, 4000.0, -3.4, -2.8, {"all": "mud"})
    box("bed", -30.0, -8.0, -46.0, 46.0, -2.8, -1.7, {"all": "mud", "+z": "track"})
    # far (west) bank: stone revetment slope and open land
    m = "stone"
    emit(g, [(-35.0, -420, -2.8), (-35.0, 420, -2.8), (-39.0, 420, 1.0), (-39.0, -420, 1.0)], m)
    for (ya, yb) in ((-4000.0, -420.0), (420.0, 4000.0)):
        emit("far", [(-35.0, ya, -2.8), (-35.0, yb, -2.8), (-39.0, yb, 1.0), (-39.0, ya, 1.0)], m)
    box(g, -110.0, -39.0, -130.0, 150.0, -2.8, 1.0, {"all": None, "+z": "grass"})
    for (xa, xb, ya, yb) in ((-4000.0, -110.0, -4000.0, 4000.0), (-110.0, -39.0, -4000.0, -130.0), (-110.0, -39.0, 150.0, 4000.0)):
        box("far", xa, xb, ya, yb, -2.8, 1.0, {"all": None, "+z": "grass"})
    for (xa, xb, ya, yb) in ((80.0, 4000.0, -4000.0, 4000.0),):
        box("far", xa, xb, ya, yb, -2.8, 1.0, {"all": None, "+z": "grass"})
    # railing along the east walk where there is no platform
    for (ya, yb) in ((-200.0, YS - 0.5), (YN + 0.5, 36.0), (114.0, 220.0)):
        y = ya
        while y < yb:
            cyl(g, (XW + 0.25, y, 1.0), (XW + 0.25, y, 2.05), 0.022, "metal_grey", seg=8, caps=False)
            y += 2.0
        for zr in (1.5, 2.0):
            cyl(g, (XW + 0.25, ya, zr), (XW + 0.25, yb, zr), 0.018, "metal_grey", seg=8, caps=False)


def build_bridge():
    g = "land"
    yc = -70.0
    # low three-span slab footbridge (平桥) from bank to bank
    box(g, -39.5, XW + 0.5, yc - 1.6, yc + 1.6, 1.5, 1.85, {"all": "concrete", "+z": "platform"})
    for xp in (-27.0, -16.0):
        box(g, xp - 0.5, xp + 0.5, yc - 1.4, yc + 1.4, -2.8, 1.5, "concrete")
        box(g, xp - 0.9, xp + 0.9, yc - 1.65, yc + 1.65, 1.35, 1.5, "concrete")
    for s in (-1, 1):
        y = yc + s * 1.5
        x = -39.4
        while x < XW + 0.5:
            box(g, x, x + 0.08, y - 0.04, y + 0.04, 1.85, 2.85, "concrete")
            x += 1.6
        box(g, -39.5, XW + 0.5, y - 0.06, y + 0.06, 2.85, 2.95, "concrete")
        box(g, -39.5, XW + 0.5, y - 0.03, y + 0.03, 2.3, 2.36, "concrete")


def build_station():
    g = "station"
    Y0, Y1 = 40.0, 112.0
    # platform with white edge line and yellow tactile strip
    box(g, XW, 0.0, Y0, Y1, 1.0, 1.18, {"all": "concrete", "+z": "platform"})
    box(g, XW, XW + 0.12, Y0, Y1, 1.18, 1.185, "whiteline")
    box(g, XW + 0.85, XW + 1.25, Y0, Y1, 1.18, 1.19, "tactile")
    box(g, 0.0, 14.0, Y0, Y1, 1.0, 1.18, {"all": "concrete", "+z": "platform"})
    pz = 1.18
    # canopy: columns, beams, cantilevers, corrugated roof, fascia
    cols = [48.0 + 8.0 * i for i in range(8)]
    for yc in cols:
        box(g, -2.1, -1.9, yc - 0.1, yc + 0.1, pz, 4.65, "metal_grey")
        box(g, -5.45, 1.2, yc - 0.06, yc + 0.06, 4.6, 4.82, "metal_grey")
    box(g, -2.12, -1.88, 46.0, 106.0, 4.62, 4.84, "metal_grey")
    emit(g, [(-5.55, 46.0, 4.86), (1.35, 46.0, 4.98), (1.35, 106.0, 4.98), (-5.55, 106.0, 4.86)], "corr")
    emit(g, [(-5.55, 106.0, 4.84), (1.35, 106.0, 4.96), (1.35, 46.0, 4.96), (-5.55, 46.0, 4.84)], "corr")
    box(g, -5.6, -5.52, 46.0, 106.0, 4.55, 4.98, "whitepaint")
    # lamps under the canopy
    for yc in cols[:-1]:
        yl = yc + 4.0
        box(g, -3.7, -3.3, yl - 0.6, yl + 0.6, 4.5, 4.6, "whitepaint")
        emit(g, [(-3.68, yl - 0.58, 4.495), (-3.32, yl - 0.58, 4.495), (-3.32, yl + 0.58, 4.495), (-3.68, yl + 0.58, 4.495)][::-1], "lampglow")
    # station clock hanging from the beam (double sided; hands dynamic)
    yck = 72.0
    cyl(g, (-2.0, yck, 4.6), (-2.0, yck, 4.25), 0.015, "metal_grey", seg=8)
    cyl(g, (-2.04, yck, 3.95), (-1.96, yck, 3.95), 0.3, "whitepaint", seg=36)
    quad_unit(g, [(-2.046, yck + 0.26, 3.69), (-2.046, yck - 0.26, 3.69), (-2.046, yck - 0.26, 4.21), (-2.046, yck + 0.26, 4.21)], "clock")
    quad_unit(g, [(-1.954, yck - 0.26, 3.69), (-1.954, yck + 0.26, 3.69), (-1.954, yck + 0.26, 4.21), (-1.954, yck - 0.26, 4.21)], "clock")
    # nameboard facing the river: the name is gone
    ys0, ys1 = 74.0, 77.6
    for yp in (ys0 + 0.15, ys1 - 0.15):
        box(g, -3.3, -3.2, yp - 0.05, yp + 0.05, pz, 3.05, "metal_grey")
    box(g, -3.25, -3.15, ys0, ys1, 2.15, 3.05, "whitepaint")
    quad_unit(g, [(-3.256, ys1, 2.15), (-3.256, ys0, 2.15), (-3.256, ys0, 3.05), (-3.256, ys1, 3.05)], "sign")
    quad_unit(g, [(-3.144, ys0, 2.15), (-3.144, ys1, 2.15), (-3.144, ys1, 3.05), (-3.144, ys0, 3.05)], "sign")
    # benches facing the river: empty chairs
    for yb in (54.0, 60.0, 84.0, 90.0):
        bench(g, -0.6, yb, pz)
    # queue rails in front of the waiting-room door
    for k in range(4):
        x = -1.2 + k * 0.6
        for y in (66.0, 68.5, 71.0):
            cyl(g, (x, y, pz), (x, y, pz + 1.0), 0.025, "metal_grey", seg=10)
        cyl(g, (x, 66.0, pz + 1.0), (x, 71.0, pz + 1.0), 0.02, "metal_grey", seg=10, caps=False)
        cyl(g, (x, 66.0, pz + 0.55), (x, 71.0, pz + 0.55), 0.016, "metal_grey", seg=10, caps=False)
    # waiting-room building
    bx0, bx1, by0, by1, bz = 0.6, 9.5, 60.0, 84.0, 5.4
    ops = [(62.0, 64.4, pz + 0.9, pz + 2.9), (66.6, 70.6, pz + 0.0, pz + 2.6), (73.0, 75.4, pz + 0.9, pz + 2.9),
           (77.0, 79.4, pz + 0.9, pz + 2.9), (80.6, 83.0, pz + 0.9, pz + 2.9)]
    wall_with_openings_x(g, bx0, bx0 + 0.24, by0, by1, pz, bz, ops, +1, "facade")
    for (oa, ob, za, zb) in ops:
        if zb - za < 2.7:
            steel_window(g, bx0 + 0.12, oa, ob, za, zb)
    box(g, bx0, bx1, by0 - 0.24, by0, pz, bz, {"all": "facade", "+y": "plaster"})
    box(g, bx0, bx1, by1, by1 + 0.24, pz, bz, {"all": "facade", "-y": "plaster"})
    box(g, bx1 - 0.24, bx1, by0, by1, pz, bz, {"all": "facade", "-x": "plaster"})
    box(g, bx0 - 0.4, bx1 + 0.2, by0 - 0.6, by1 + 0.6, bz, bz + 0.35, {"all": "band", "-z": "ceiling"})
    box(g, bx0 + 0.24, bx1 - 0.24, by0, by1, pz, pz + 0.01, {"all": "terrazzo"})
    for yb in (63.0, 75.0, 79.0):
        bench(g, bx1 - 0.9, yb, pz, facing=-1)
    # lamp posts beyond the canopy
    for yl in (40.5, 110.0):
        cyl(g, (-1.0, yl, pz), (-1.0, yl, pz + 4.8), 0.06, "metal_grey", seg=12)
        box(g, -1.6, -0.9, yl - 0.12, yl + 0.12, pz + 4.7, pz + 4.85, "metal_grey")


def bench(g, xc, yc, z, facing=1):
    L = 2.4
    for sx in (-L / 2 + 0.1, 0.0, L / 2 - 0.1):
        box(g, xc - 0.25, xc + 0.25, yc + sx - 0.03, yc + sx + 0.03, z, z + 0.43, "metal_grey")
        bx = xc + 0.22 * facing
        box(g, min(bx, bx + 0.04 * facing), max(bx, bx + 0.04 * facing), yc + sx - 0.03, yc + sx + 0.03, z + 0.43, z + 0.88, "metal_grey")
    for k in range(4):
        xs = xc - 0.22 + k * 0.11
        box(g, xs * 1 if facing > 0 else xs, (xs + 0.09), yc - L / 2, yc + L / 2, z + 0.43, z + 0.46, "wood")
    for k in range(3):
        zz = z + 0.55 + k * 0.11
        bx = xc + 0.24 * facing
        box(g, min(bx, bx + 0.03 * facing), max(bx, bx + 0.03 * facing), yc - L / 2, yc + L / 2, zz, zz + 0.08, "wood")


# --------------------------------------------------------------- to Blender
def blender_material(name, spec):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = spec.get("rough", 0.8)
    bsdf.inputs["Metallic"].default_value = spec.get("metal", 0.0)
    if "tex" in spec:
        img = bpy.data.images.load(str(TEX / f"{spec['tex']}_col.png"), check_existing=True)
        tn = nt.nodes.new("ShaderNodeTexImage")
        tn.image = img
        uv = nt.nodes.new("ShaderNodeUVMap")
        uv.uv_map = "UVMap"
        mp = nt.nodes.new("ShaderNodeMapping")
        s = 1.0 if spec.get("unit") else 1.0 / spec.get("tile", 1.0)
        mp.inputs["Scale"].default_value = (s, s, 1)
        nt.links.new(uv.outputs["UV"], mp.inputs["Vector"])
        nt.links.new(mp.outputs["Vector"], tn.inputs["Vector"])
        if "tint" in spec:
            mix = nt.nodes.new("ShaderNodeMix")
            mix.data_type = "RGBA"
            mix.blend_type = "MULTIPLY"
            mix.inputs["Factor"].default_value = 1.0
            nt.links.new(tn.outputs["Color"], mix.inputs["A"])
            mix.inputs["B"].default_value = (*spec["tint"], 1)
            nt.links.new(mix.outputs["Result"], bsdf.inputs["Base Color"])
        else:
            nt.links.new(tn.outputs["Color"], bsdf.inputs["Base Color"])
    else:
        bsdf.inputs["Base Color"].default_value = (*spec["col"], 1)
    if "emit" in spec:
        bsdf.inputs["Emission Color"].default_value = (*spec["emit"], 1)
        bsdf.inputs["Emission Strength"].default_value = 0.0  # lamps are switched on per bake state
    return m


def to_object(gr, coll):
    me = bpy.data.meshes.new(gr.name)
    verts, faces, uvs, mats, smooth = [], [], [], [], []
    mat_names = sorted({f[1] for f in gr.faces})
    mindex = {m: i for i, m in enumerate(mat_names)}
    for pts, mat, uv, sm in gr.faces:
        base = len(verts)
        verts.extend([tuple(p) for p in pts])
        faces.append(tuple(range(base, base + len(pts))))
        mats.append(mindex[mat])
        smooth.append(sm)
        if uv is None:
            n = face_normal(pts)
            ax = max(range(3), key=lambda i: abs(n[i]))
            if ax == 0:
                uv = [(p.y * (1 if n.x > 0 else -1), p.z) for p in pts]
            elif ax == 1:
                uv = [(-p.x * (1 if n.y > 0 else -1), p.z) for p in pts]
            else:
                uv = [(p.x, p.y * (1 if n.z > 0 else -1)) for p in pts]
        uvs.extend(uv)
    me.from_pydata(verts, [], faces)
    uvl = me.uv_layers.new(name="UVMap")
    for i, l in enumerate(me.loops):
        uvl.data[i].uv = uvs[i]
    for i, p in enumerate(me.polygons):
        p.material_index = mats[i]
        p.use_smooth = smooth[i]
    for m in mat_names:
        me.materials.append(bpy.data.materials[m])
    # merge coincident vertices so smooth faces share normals
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.to_mesh(me)
    bm.free()
    me.validate()
    ob = bpy.data.objects.new(gr.name, me)
    coll.objects.link(ob)
    return ob


def lightmap_uv(ob, margin):
    bpy.context.view_layer.objects.active = ob
    for o in bpy.context.view_layer.objects:
        o.select_set(o == ob)
    me = ob.data
    lm = me.uv_layers.new(name="LM")
    me.uv_layers.active = lm
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=margin, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
    bpy.ops.uv.pack_islands(rotate=True, margin=margin)
    bpy.ops.object.mode_set(mode="OBJECT")
    me.uv_layers.active = me.uv_layers["UVMap"]
    me.uv_layers["UVMap"].active_render = True


# Bake groups: name -> lightmap resolution
BAKE = {"room": 4096, "furn": 4096, "bldg": 4096, "station": 4096, "land": 4096}
DYNAMIC = ["far", "bed", "glass", "sash", "sash_glass", "hand_h", "hand_m", "hand_s", "key", "letter", "letter_sheet"] + [f"curtain_{i}" for i in range(6)]


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for name in BAKE:
        group(name, BAKE[name])
    for name in DYNAMIC:
        group(name, 0, dynamic=True)
    # routing: faces inside the hero classroom go to the dense "room" lightmap
    ROUTES.append((lambda c, n: in_hero(c, n), "room"))

    build_building()
    ROUTES.clear()   # furniture is its own group; it must not be routed into "room"
    build_hero_room()
    build_dynamic()
    build_banks()
    build_bridge()
    build_station()

    for name, spec in MATS.items():
        blender_material(name, spec)
    coll = bpy.context.scene.collection
    stats = {}
    for gname, gr in GROUPS.items():
        if not gr.faces:
            continue
        ob = to_object(gr, coll)
        stats[gname] = len(gr.faces)
        if gname in BAKE:
            lightmap_uv(ob, margin=0.0012 if BAKE[gname] >= 4096 else 0.002)
    print("faces per group:", stats)
    out = ROOT / "assets"
    bpy.ops.wm.save_as_mainfile(filepath=str(out / "world.blend"))
    # material table for the Three.js side
    (out / "materials.json").write_text(json.dumps(MATS, indent=1))
    layout = dict(hero=HERO, floors=FLOORS, xw=XW, river=dict(x0=-35.0, x1=XW, level=0.0),
                  station=dict(clock=[-2.0, 72.0, 3.95], sign=[-3.2, 75.8, 2.6]),
                  hero_clock=[(HERO["x0"] + HERO["x1"]) / 2, HERO["y1"] - 0.058, 3.72],
                  sash=dict(x=XW + 0.08, y=-0.4 + 0.0225, z=FLOORS[0][0] + 0.9 + 0.045),
                  key=[XWI + 0.04, 0.42, 1.9 + 0.0005],
                  letter=[-4.62, 0.62, FLOORS[0][0] + 0.76 + 0.001],
                  curtains=[[XWI + 0.1, wc + (-1.38 if s < 0 else 0.83), 4.13] for wc in (-3.3, 0.0, 3.3) for s in (-1, 1)])
    (out / "layout.json").write_text(json.dumps(layout, indent=1))


if __name__ == "__main__":
    main()
