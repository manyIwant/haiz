"""Architectural components for the HAIZ twin, in a facade-local frame.

Facade-local frame (see kit.seg_frame): X along the facade (left -> right seen from outside),
Y into the building (exterior face at Y = 0, protrusions at Y < 0), Z up from the floor datum.
Seen from outside, X points right and Z up, so a polygon listed counter-clockwise in (X, Z)
faces the viewer (-Y).  Every face here is emitted with an explicit outward normal (Geo.polyn)
so the exported meshes are correctly oriented without relying on double-sided materials.
All dimensions are metres.
"""
from __future__ import annotations
import math
from mathutils import Vector, Matrix
from kit import Geo, V

OUT = (0.0, -1.0, 0.0)     # facade outward normal in the local frame


# ---------------------------------------------------------------------------------------
# walls with real openings
# ---------------------------------------------------------------------------------------

def reveal(g: Geo, mat: str, x0: float, x1: float, zb: float, zt: float, y: float, t: float, sill=True, head=True):
    """The four reveal faces of a rectangular opening (normals point into the opening)."""
    g.polyn(mat, [(x0, y, zb), (x0, y + t, zb), (x0, y + t, zt), (x0, y, zt)], (1, 0, 0))
    g.polyn(mat, [(x1, y, zb), (x1, y + t, zb), (x1, y + t, zt), (x1, y, zt)], (-1, 0, 0))
    if head:
        g.polyn(mat, [(x0, y, zt), (x1, y, zt), (x1, y + t, zt), (x0, y + t, zt)], (0, 0, -1))
    if sill:
        g.polyn(mat, [(x0, y, zb), (x1, y, zb), (x1, y + t, zb), (x0, y + t, zb)], (0, 0, 1))


def wall_with_openings(g: Geo, mat: str, width: float, z0: float, z1: float, openings,
                       t: float = 0.24, reveal_mat: str | None = None, y: float = 0.0, back: bool = False):
    """Outer skin of a wall X=0..width, Z=z0..z1 on the plane Y=y, punched by rectangular
    openings [(x0, x1, zb, zt), ...] with reveals of depth t.  Openings must not overlap."""
    rm = reveal_mat or mat
    ops = [(max(0.0, a), min(width, b), max(z0, c), min(z1, d)) for a, b, c, d in openings]
    ops = [o for o in ops if o[1] > o[0] + 1e-4 and o[3] > o[2] + 1e-4]
    zs = sorted({z0, z1, *[o[2] for o in ops], *[o[3] for o in ops]})
    for za, zb in zip(zs[:-1], zs[1:]):
        zm = 0.5 * (za + zb)
        cuts = sorted((o[0], o[1]) for o in ops if o[2] < zm < o[3])
        x = 0.0
        for a, b in cuts + [(width, width)]:
            if a > x + 1e-5:
                g.polyn(mat, [(x, y, za), (a, y, za), (a, y, zb), (x, y, zb)], OUT)
            x = max(x, b)
    for x0, x1, zb, zt in ops:
        reveal(g, rm, x0, x1, zb, zt, y, t, sill=zb > z0 + 1e-4)
    if back:
        g.polyn(mat, [(0, y + t, z0), (width, y + t, z0), (width, y + t, z1), (0, y + t, z1)], (0, 1, 0))


def plain_wall(g: Geo, mat: str, width: float, z0: float, z1: float, y: float = 0.0):
    g.polyn(mat, [(0, y, z0), (width, y, z0), (width, y, z1), (0, y, z1)], OUT)


def surround(g: Geo, mat: str, x0: float, x1: float, zb: float, zt: float, w: float = 0.10, proj: float = 0.04,
             y: float = 0.0, sill: bool = False):
    """Projecting flat architrave around an opening (on the facade plane)."""
    g.box(mat, (x0 - w, y - proj, zt), (x1 + w, y, zt + w), skip=('+y',))
    g.box(mat, (x0 - w, y - proj, zb - (w if sill else 0.0)), (x0, y, zt), skip=('+y',))
    g.box(mat, (x1, y - proj, zb - (w if sill else 0.0)), (x1 + w, y, zt), skip=('+y',))
    if sill:
        g.box(mat, (x0, y - proj, zb - w), (x1, y, zb), skip=('+y',))


# ---------------------------------------------------------------------------------------
# windows (built once, instanced many times)
# ---------------------------------------------------------------------------------------

def window_unit(w: float, h: float, cols: int = 3, transom: float | None = 0.72, set_back: float = 0.10,
                frame: float = 0.06, depth: float = 0.07, mull: float = 0.045, sill: float = 0.05,
                frame_mat='frame.alu.white', glass_mat='glass.window', sill_mat='stone.granite.white',
                interior: str | None = 'interior.dark', curtain: float = 0.0, curtain_mat='interior.curtain',
                arch: bool = False, reveal: float = 0.24, top_cols: int | None = None, bars: float = 0.0) -> Geo:
    """A complete window for an opening of w x h (origin at the opening's lower-left corner on
    the facade plane): projecting sill, frame, mullions, transom, glass, optional curtains,
    optional security bars over the lower `bars` fraction, and a dark interior box so that
    looking into the window never shows a void.  arch=True: round head of diameter w."""
    g = Geo()
    yb = set_back
    if sill:
        g.box(sill_mat, (-0.04, -sill, -0.03), (w + 0.04, yb, 0.0))
    gy = yb + depth * 0.5
    if arch:
        r = w / 2
        hr = h - r
        _frame_rect(g, frame_mat, 0, w, 0, hr, yb, frame, depth, top=False)
        _arch_frame(g, frame_mat, w / 2, hr, r, yb, frame, depth)
        for i in range(1, cols):
            x = w * i / cols
            ztop = hr + math.sqrt(max(0.0, r * r - (x - r) ** 2)) - frame * 0.5
            g.box(frame_mat, (x - mull / 2, yb, frame), (x + mull / 2, yb + depth * 0.8, ztop))
        g.box(frame_mat, (frame, yb, hr - mull / 2), (w - frame, yb + depth * 0.8, hr + mull / 2))
        g.polyn(glass_mat, [(frame, gy, frame), (w - frame, gy, frame), (w - frame, gy, hr), (frame, gy, hr)], OUT)
        n = 18
        rr = r - frame
        for i in range(n):
            a0 = math.pi * i / n; a1 = math.pi * (i + 1) / n
            g.polyn(glass_mat, [(r, gy, hr), (r + rr * math.cos(a0), gy, hr + rr * math.sin(a0)),
                                (r + rr * math.cos(a1), gy, hr + rr * math.sin(a1))], OUT)
    else:
        _frame_rect(g, frame_mat, 0, w, 0, h, yb, frame, depth)
        zt = h * transom if transom else None
        if zt:
            g.box(frame_mat, (frame, yb, zt - mull / 2), (w - frame, yb + depth * 0.9, zt + mull / 2))
        for i in range(1, cols):
            x = w * i / cols
            g.box(frame_mat, (x - mull / 2, yb, frame), (x + mull / 2, yb + depth * 0.9, (zt - mull / 2) if zt else h - frame))
        if zt:
            tc = top_cols if top_cols is not None else cols
            for i in range(1, tc):
                x = w * i / tc
                g.box(frame_mat, (x - mull / 2, yb, zt + mull / 2), (x + mull / 2, yb + depth * 0.9, h - frame))
        g.polyn(glass_mat, [(frame, gy, frame), (w - frame, gy, frame), (w - frame, gy, h - frame), (frame, gy, h - frame)], OUT)
        if bars > 0:
            nb = max(2, int(w / 0.12))
            for i in range(1, nb):
                x = w * i / nb
                g.box('metal.steel.white', (x - 0.008, yb - 0.06, frame), (x + 0.008, yb - 0.04, h * bars))
            g.box('metal.steel.white', (frame, yb - 0.065, h * bars - 0.02), (w - frame, yb - 0.035, h * bars))
    if interior:
        iy = reveal + 0.9
        g.polyn(interior, [(-0.3, iy, -0.3), (w + 0.3, iy, -0.3), (w + 0.3, iy, h + 0.3), (-0.3, iy, h + 0.3)], OUT)
        g.polyn(interior, [(-0.3, reveal, -0.3), (-0.3, iy, -0.3), (-0.3, iy, h + 0.3), (-0.3, reveal, h + 0.3)], (1, 0, 0))
        g.polyn(interior, [(w + 0.3, reveal, -0.3), (w + 0.3, iy, -0.3), (w + 0.3, iy, h + 0.3), (w + 0.3, reveal, h + 0.3)], (-1, 0, 0))
        g.polyn(interior, [(-0.3, reveal, h + 0.3), (w + 0.3, reveal, h + 0.3), (w + 0.3, iy, h + 0.3), (-0.3, iy, h + 0.3)], (0, 0, -1))
        g.polyn(interior, [(-0.3, reveal, -0.3), (w + 0.3, reveal, -0.3), (w + 0.3, iy, -0.3), (-0.3, iy, -0.3)], (0, 0, 1))
    if curtain > 0:
        cy = yb + depth + 0.25
        cw = w * curtain / 2
        ch = (h - 0.05) if not arch else (h - w / 2)
        g.polyn(curtain_mat, [(0.02, cy, 0.05), (cw, cy, 0.05), (cw, cy, ch), (0.02, cy, ch)], OUT)
        g.polyn(curtain_mat, [(w - cw, cy, 0.05), (w - 0.02, cy, 0.05), (w - 0.02, cy, ch), (w - cw, cy, ch)], OUT)
    return g


def _frame_rect(g, mat, x0, x1, z0, z1, yb, f, d, top=True):
    g.box(mat, (x0, yb, z0), (x0 + f, yb + d, z1))
    g.box(mat, (x1 - f, yb, z0), (x1, yb + d, z1))
    g.box(mat, (x0 + f, yb, z0), (x1 - f, yb + d, z0 + f))
    if top:
        g.box(mat, (x0 + f, yb, z1 - f), (x1 - f, yb + d, z1))


def _arch_frame(g, mat, cx, cz, r, yb, f, d, n=18):
    for i in range(n):
        a0 = math.pi * i / n; a1 = math.pi * (i + 1) / n
        o0 = (cx + r * math.cos(a0), cz + r * math.sin(a0)); o1 = (cx + r * math.cos(a1), cz + r * math.sin(a1))
        i0 = (cx + (r - f) * math.cos(a0), cz + (r - f) * math.sin(a0)); i1 = (cx + (r - f) * math.cos(a1), cz + (r - f) * math.sin(a1))
        g.polyn(mat, [(o0[0], yb, o0[1]), (o1[0], yb, o1[1]), (i1[0], yb, i1[1]), (i0[0], yb, i0[1])], OUT)
        mx, mz = (i0[0] + i1[0]) / 2 - cx, (i0[1] + i1[1]) / 2 - cz
        g.polyn(mat, [(i0[0], yb, i0[1]), (i1[0], yb, i1[1]), (i1[0], yb + d, i1[1]), (i0[0], yb + d, i0[1])], (-mx, 0, -mz))


def arched_opening_wall(g: Geo, mat: str, width: float, z0: float, z1: float, x0: float, w: float,
                        zb: float, h: float, t=0.24, n=18, y=0.0):
    """Wall panel with one round-headed opening (rectangle of height h - w/2 plus a semicircle)."""
    r = w / 2; hr = zb + h - r; cx = x0 + r
    g.polyn(mat, [(0, y, z0), (x0, y, z0), (x0, y, z1), (0, y, z1)], OUT)
    g.polyn(mat, [(x0 + w, y, z0), (width, y, z0), (width, y, z1), (x0 + w, y, z1)], OUT)
    g.polyn(mat, [(x0, y, z0), (x0 + w, y, z0), (x0 + w, y, zb), (x0, y, zb)], OUT)
    reveal(g, mat, x0, x0 + w, zb, hr, y, t, head=False)
    for i in range(n):
        a0 = math.pi * i / n; a1 = math.pi * (i + 1) / n
        p0 = (cx + r * math.cos(a0), hr + r * math.sin(a0)); p1 = (cx + r * math.cos(a1), hr + r * math.sin(a1))
        g.polyn(mat, [(p0[0], y, p0[1]), (p0[0], y, z1), (p1[0], y, z1), (p1[0], y, p1[1])], OUT)
        mx, mz = (p0[0] + p1[0]) / 2 - cx, (p0[1] + p1[1]) / 2 - hr
        g.polyn(mat, [(p0[0], y, p0[1]), (p1[0], y, p1[1]), (p1[0], y + t, p1[1]), (p0[0], y + t, p0[1])], (-mx, 0, -mz))


# ---------------------------------------------------------------------------------------
# linear elements
# ---------------------------------------------------------------------------------------

def band(g: Geo, mat: str, x0: float, x1: float, z0: float, z1: float, proj: float, y=0.0, ends=True):
    """A horizontal projecting band / string course on the facade (box from Y=y-proj to y)."""
    skip = () if ends else ('-x', '+x')
    g.box(mat, (x0, y - proj, z0), (x1, y, z1), skip=skip + ('+y',))


def cornice(g: Geo, mat: str, x0: float, x1: float, z: float, profile, y=0.0, returns=True):
    """Sweep a (dy, dz) profile along X from x0 to x1 at height z.  The profile runs from the wall
    at the bottom, outwards and up, and back to the wall at the top (dy < 0 projects out)."""
    pts = list(profile)
    for (ya, za), (yb, zb) in zip(pts[:-1], pts[1:]):
        # outward normal of this profile segment in the (y, z) plane: rotate (dy, dz) by -90 deg
        dy, dz = yb - ya, zb - za
        nrm = (0.0, dz, -dy)
        if abs(dy) < 1e-9 and abs(dz) < 1e-9:
            continue
        g.polyn(mat, [(x0, y + ya, z + za), (x1, y + ya, z + za), (x1, y + yb, z + zb), (x0, y + yb, z + zb)], nrm)
    if returns:
        ring = [(dy, dz) for dy, dz in pts]
        if abs(ring[-1][0]) > 1e-9:
            ring.append((0.0, ring[-1][1]))
        if abs(ring[0][0]) > 1e-9:
            ring.insert(0, (0.0, ring[0][1]))
        g.polyn(mat, [(x0, y + dy, z + dz) for dy, dz in ring], (-1, 0, 0))
        g.polyn(mat, [(x1, y + dy, z + dz) for dy, dz in ring], (1, 0, 0))


CORNICE_EAVE = [(0.0, 0.0), (-0.08, 0.0), (-0.08, 0.12), (-0.25, 0.20), (-0.30, 0.38), (-0.30, 0.50), (0.0, 0.50)]
CORNICE_SMALL = [(0.0, 0.0), (-0.06, 0.0), (-0.06, 0.08), (-0.14, 0.14), (-0.14, 0.22), (0.0, 0.22)]
CORNICE_DEEP = [(0.0, 0.0), (-0.10, 0.0), (-0.10, 0.20), (-0.45, 0.30), (-0.55, 0.55), (-0.55, 0.75), (0.0, 0.75)]


def pilaster(g: Geo, mat: str, x: float, w: float, proj: float, z0: float, z1: float, cap: float = 0.0, y=0.0,
             cap_mat: str | None = None, base: float = 0.0):
    g.box(mat, (x - w / 2, y - proj, z0 + base), (x + w / 2, y, z1 - cap), skip=('+y',))
    if base > 0:
        g.box(cap_mat or mat, (x - w / 2 - 0.05, y - proj - 0.05, z0), (x + w / 2 + 0.05, y, z0 + base), skip=('+y',))
    if cap > 0:
        cm = cap_mat or mat
        g.box(cm, (x - w / 2 - 0.06, y - proj - 0.06, z1 - cap), (x + w / 2 + 0.06, y, z1 - cap * 0.55), skip=('+y',))
        g.box(cm, (x - w / 2 - 0.10, y - proj - 0.10, z1 - cap * 0.55), (x + w / 2 + 0.10, y, z1), skip=('+y',))


def square_column(g: Geo, mat: str, cx: float, cy: float, w: float, z0: float, z1: float, base=0.0, cap=0.0,
                  base_mat=None, cap_mat=None):
    g.box(mat, (cx - w / 2, cy - w / 2, z0 + base), (cx + w / 2, cy + w / 2, z1 - cap), skip=('-z', '+z'))
    if base:
        g.box(base_mat or mat, (cx - w / 2 - 0.06, cy - w / 2 - 0.06, z0), (cx + w / 2 + 0.06, cy + w / 2 + 0.06, z0 + base), skip=('-z',))
    if cap:
        g.box(cap_mat or mat, (cx - w / 2 - 0.08, cy - w / 2 - 0.08, z1 - cap), (cx + w / 2 + 0.08, cy + w / 2 + 0.08, z1))


def stairs(g: Geo, mat: str, x0: float, x1: float, y_top: float, z_bottom: float, z_top: float,
           n: int | None = None, tread: float = 0.32, direction: int = -1, side_mat: str | None = None,
           cheeks: bool = True):
    """Straight flight across X = x0..x1 descending along Y from a landing edge at (y_top, z_top)
    to the ground at z_bottom.  direction = -1 descends towards -Y.  Returns (n, riser)."""
    H = z_top - z_bottom
    if H <= 1e-4:
        return 0, 0.0
    n = n or max(1, round(H / 0.15))
    r = H / n
    sm = side_mat or mat
    dvec = (0.0, float(direction), 0.0)
    for i in range(n):
        yi = y_top + direction * i * tread
        yj = y_top + direction * (i + 1) * tread
        zt = z_top - i * r
        zb = zt - r
        g.polyn(mat, [(x0, yi, zb), (x1, yi, zb), (x1, yi, zt), (x0, yi, zt)], dvec)
        if i < n - 1:
            g.polyn(mat, [(x0, yi, zb), (x1, yi, zb), (x1, yj, zb), (x0, yj, zb)], (0, 0, 1))
            if cheeks:
                g.polyn(sm, [(x0, yi, z_bottom), (x0, yj, z_bottom), (x0, yj, zb), (x0, yi, zb)], (-1, 0, 0))
                g.polyn(sm, [(x1, yi, z_bottom), (x1, yj, z_bottom), (x1, yj, zb), (x1, yi, zb)], (1, 0, 0))
    return n, r


def railing(g: Geo, path, h: float = 1.05, post: float = 1.2, mat='metal.steel.white', rail=0.05, bars: float = 0.12,
            bar_w: float = 0.02, base: float = 0.0, posts: bool = True):
    """Balustrade along a 3D polyline: top rail, bottom rail, posts and vertical bars."""
    P = [Vector(p) for p in path]
    for a, b in zip(P[:-1], P[1:]):
        d = b - a; L = d.length
        if L < 1e-4:
            continue
        u = d / L
        left = Vector((-u.y, u.x, 0.0))
        if left.length < 1e-6:
            left = Vector((1, 0, 0))
        left.normalize()
        up = Vector((0, 0, 1))

        def rbox(z0, z1, s0, s1, wid):
            p0 = a + u * s0; p1 = a + u * s1
            sd = left * (wid / 2)
            Z0 = up * z0; Z1 = up * z1
            g.polyn(mat, [p0 - sd + Z1, p1 - sd + Z1, p1 + sd + Z1, p0 + sd + Z1], (0, 0, 1))
            g.polyn(mat, [p0 - sd + Z0, p1 - sd + Z0, p1 + sd + Z0, p0 + sd + Z0], (0, 0, -1))
            g.polyn(mat, [p0 - sd + Z0, p1 - sd + Z0, p1 - sd + Z1, p0 - sd + Z1], -left)
            g.polyn(mat, [p0 + sd + Z0, p1 + sd + Z0, p1 + sd + Z1, p0 + sd + Z1], left)
            g.polyn(mat, [p0 - sd + Z0, p0 + sd + Z0, p0 + sd + Z1, p0 - sd + Z1], -u)
            g.polyn(mat, [p1 - sd + Z0, p1 + sd + Z0, p1 + sd + Z1, p1 - sd + Z1], u)
        rbox(base + h - rail, base + h, 0, L, rail * 1.4)
        if bars or posts:
            rbox(base + 0.08, base + 0.08 + rail * 0.6, 0, L, rail)
        if posts:
            npost = max(1, int(round(L / post)))
            for i in range(npost + 1):
                s = L * i / npost
                rbox(base, base + h - rail, max(0, s - rail / 2), min(L, s + rail / 2), rail)
        if bars:
            nb = int(L / bars)
            for i in range(1, nb):
                s = L * i / nb
                rbox(base + 0.08 + rail * 0.6, base + h - rail, s - bar_w / 2, s + bar_w / 2, bar_w)


def louvre_box(g: Geo, x0: float, x1: float, z0: float, z1: float, depth: float = 0.6, frame_mat='trim.white',
               slat_mat='frame.alu.grey', y=0.0, n=None):
    """A framed louvre panel (plant room / stair-top vent) proud of the wall."""
    f = 0.18
    g.box(frame_mat, (x0, y - depth, z0), (x1, y, z0 + f), skip=('+y',))
    g.box(frame_mat, (x0, y - depth, z1 - f), (x1, y, z1), skip=('+y',))
    g.box(frame_mat, (x0, y - depth, z0 + f), (x0 + f, y, z1 - f), skip=('+y',))
    g.box(frame_mat, (x1 - f, y - depth, z0 + f), (x1, y, z1 - f), skip=('+y',))
    g.polyn('interior.dark', [(x0 + f, y - 0.1, z0 + f), (x1 - f, y - 0.1, z0 + f), (x1 - f, y - 0.1, z1 - f), (x0 + f, y - 0.1, z1 - f)], OUT)
    n = n or max(3, int((z1 - z0 - 2 * f) / 0.12))
    for i in range(n):
        z = z0 + f + (z1 - z0 - 2 * f) * (i + 0.5) / n
        g.polyn(slat_mat, [(x0 + f, y - depth + 0.05, z - 0.04), (x1 - f, y - depth + 0.05, z - 0.04),
                           (x1 - f, y - depth + 0.25, z + 0.04), (x0 + f, y - depth + 0.25, z + 0.04)], (0, -0.5, 1))


# ---------------------------------------------------------------------------------------
# roofs
# ---------------------------------------------------------------------------------------

def hip_roof(g: Geo, x0: float, y0: float, x1: float, y1: float, z_eave: float, pitch_deg: float,
             overhang: float = 0.8, mat='roof.tile.red', fascia_mat='trim.white', fascia_h=0.35,
             concave: float = 0.0, upturn: float = 0.0, upturn_len: float = 3.0, kick: float = 0.0,
             ridge_mat: str | None = 'trim.white', ridge_w=0.28, ridge_h=0.22, nseg=10, tiles=True,
             tile_pitch=0.23, soffit_mat='trim.white', ridge_ends=0.0, thick=0.18, main_ridge_axis=None, hip_run=None):
    """Hip roof over the axis-aligned rectangle [x0,x1]x[y0,y1] (walls), with eave overhang.

    concave: 0 = straight slopes; >0 = traditional sag (surface lowered mid-slope by that
             fraction of the rise), flatter at the eaves.
    upturn:  metres the eave corners rise above the straight eave line (起翘), fading over
             upturn_len from each corner.
    kick:    metres the corners also extend outwards (出翘).
    """
    X0, Y0, X1, Y1 = x0 - overhang, y0 - overhang, x1 + overhang, y1 + overhang
    L, D = X1 - X0, Y1 - Y0
    long_x = L >= D if main_ridge_axis is None else main_ridge_axis == 'x'
    half = (D if long_x else L) / 2
    rise = half * math.tan(math.radians(pitch_deg))
    zr = z_eave + rise
    cx, cy = (X0 + X1) / 2, (Y0 + Y1) / 2
    end_run = half if hip_run is None else hip_run
    if long_x:
        ra = (X0 + end_run, cy); rb = (X1 - end_run, cy)
    else:
        ra = (cx, Y0 + end_run); rb = (cx, Y1 - end_run)
    corners = [(X0, Y0), (X1, Y0), (X1, Y1), (X0, Y1)]

    def eave_pt(p, sa, sb, outward):
        dmin = min(sa, sb)
        f = max(0.0, 1.0 - dmin / upturn_len) if upturn_len > 0 else 0.0
        f = f * f
        return Vector((p[0] + outward[0] * kick * f, p[1] + outward[1] * kick * f, z_eave + upturn * f))

    if long_x:
        faces = [((X0, Y0), (X1, Y0), rb, ra, (0, -1)),
                 ((X1, Y0), (X1, Y1), rb, rb, (1, 0)),
                 ((X1, Y1), (X0, Y1), ra, rb, (0, 1)),
                 ((X0, Y1), (X0, Y0), ra, ra, (-1, 0))]
    else:
        faces = [((X0, Y0), (X1, Y0), ra, ra, (0, -1)),
                 ((X1, Y0), (X1, Y1), rb, ra, (1, 0)),
                 ((X1, Y1), (X0, Y1), rb, rb, (0, 1)),
                 ((X0, Y1), (X0, Y0), ra, rb, (-1, 0))]
    for A, B, RB, RA, nrm in faces:
        elen = math.hypot(B[0] - A[0], B[1] - A[1])
        nu = max(2, int(elen / 1.0))
        rows = []
        for j in range(nseg + 1):
            t = j / nseg
            row = []
            for i in range(nu + 1):
                u = i / nu
                pe = (A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u)
                E = eave_pt(pe, u * elen, (1 - u) * elen, nrm)
                Rp = Vector((RA[0] + (RB[0] - RA[0]) * u, RA[1] + (RB[1] - RA[1]) * u, zr))
                P = E.lerp(Rp, t)
                if concave > 0:
                    P.z -= concave * rise * math.sin(math.pi * t) * (1 - 0.3 * t)
                row.append(P)
            rows.append(row)
        up_out = (nrm[0], nrm[1], 1.0)
        for j in range(nseg):
            for i in range(nu):
                pts = [rows[j][i], rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i]]
                if (pts[2] - pts[3]).length < 1e-6:
                    pts = pts[:3]
                g.polyn(mat, pts, up_out)
        def inset(p):
            return Vector((min(max(p.x, x0), x1), min(max(p.y, y0), y1), z_eave - fascia_h))
        for i in range(nu):
            p, q = rows[0][i], rows[0][i + 1]
            pz = Vector((p.x, p.y, p.z - fascia_h)); qz = Vector((q.x, q.y, q.z - fascia_h))
            g.polyn(fascia_mat, [pz, qz, q, p], (nrm[0], nrm[1], 0.0))
            g.polyn(soffit_mat, [inset(p), inset(q), qz, pz], (0, 0, -1))
        if tiles and mat:
            _tile_rows(g, rows, mat, tile_pitch)
    if ridge_mat:
        if math.dist(ra, rb) > 1e-3:
            _ridge(g, ridge_mat, Vector((*ra, zr)), Vector((*rb, zr)), ridge_w, ridge_h)
        for (cxp, cyp) in corners:
            r_end = ra if math.dist((cxp, cyp), ra) < math.dist((cxp, cyp), rb) else rb
            Ept = Vector((cxp, cyp, z_eave + upturn))
            if kick:
                ox = 1 if cxp > cx else -1; oy = 1 if cyp > cy else -1
                Ept.x += ox * kick * 0.7; Ept.y += oy * kick * 0.7
            _hip_curve(g, ridge_mat, Ept, Vector((*r_end, zr)), ridge_w * 0.8, ridge_h * 0.8, concave * rise)
            if upturn > 0:
                # small upswept tip (翘角) at each corner
                tip = Ept + Vector(((1 if cxp > cx else -1) * 0.35, (1 if cyp > cy else -1) * 0.35, upturn * 0.9 + 0.25))
                _ridge(g, ridge_mat, Ept, tip, ridge_w * 0.7, ridge_h * 0.7)
        if ridge_ends > 0 and math.dist(ra, rb) > 1e-3:
            for p, s in ((ra, -1), (rb, 1)):
                d = Vector((rb[0] - ra[0], rb[1] - ra[1], 0)).normalized() * s
                base = Vector((*p, zr + ridge_h))
                tip = base + d * ridge_ends * 0.6 + Vector((0, 0, ridge_ends))
                _ridge(g, ridge_mat, base - d * 0.6, tip, ridge_w * 0.9, ridge_h * 0.9)
    return dict(z_ridge=zr, rise=rise, ridge=(ra, rb), eave_rect=(X0, Y0, X1, Y1))


def _tile_rows(g: Geo, rows, mat, pitch):
    """Raised round tile ridges (筒瓦-like) running eave -> ridge along the slope."""
    nseg = len(rows) - 1
    nu = len(rows[0]) - 1
    A = rows[0][0]; B = rows[0][-1]
    elen = (B - A).length
    n = max(1, int(elen / pitch))
    for k in range(1, n):
        u = k / n * nu
        i = min(int(u), nu - 1); f = u - i
        pts = [rows[j][i].lerp(rows[j][i + 1], f) for j in range(nseg + 1)]
        if (pts[-1] - pts[0]).length < 0.5:
            continue
        side = (rows[0][i + 1] - rows[0][i]).normalized()
        r = 0.055
        prev = None
        fwd = (pts[1] - pts[0]).normalized()
        for j in range(nseg + 1):
            p = pts[j]
            if j < nseg:
                fwd = (pts[j + 1] - p).normalized()
            up = side.cross(fwd).normalized()
            if up.z < 0:
                up = -up
            ring = [p + side * (r * math.cos(a)) + up * (r * math.sin(a)) for a in (0.0, math.pi / 3, 2 * math.pi / 3, math.pi)]
            if prev is not None:
                for q in range(3):
                    mid = (prev[q] + prev[q + 1]) * 0.5 - (pts[j - 1])
                    g.polyn(mat, [prev[q], prev[q + 1], ring[q + 1], ring[q]], mid)
            prev = ring


def _ridge(g: Geo, mat, a: Vector, b: Vector, w, h):
    d = (b - a)
    L = d.length
    if L < 1e-4:
        return
    u = d / L
    s = Vector((-u.y, u.x, 0))
    if s.length < 1e-6:
        s = Vector((1, 0, 0))
    s.normalize()
    up = u.cross(s).normalized()
    if up.z < 0:
        up = -up
    c = [(-w / 2, 0), (-w / 2, h * 0.6), (-w * 0.3, h), (w * 0.3, h), (w / 2, h * 0.6), (w / 2, 0)]
    ra = [a + s * x + up * y for x, y in c]
    rb = [b + s * x + up * y for x, y in c]
    for i in range(len(c) - 1):
        mx = (c[i][0] + c[i + 1][0]) / 2; my = (c[i][1] + c[i + 1][1]) / 2 - h * 0.4
        g.polyn(mat, [ra[i], rb[i], rb[i + 1], ra[i + 1]], s * mx + up * my)
    g.polyn(mat, ra, -u)
    g.polyn(mat, rb, u)


def _hip_curve(g: Geo, mat, a: Vector, b: Vector, w, h, sag, n=8):
    pts = []
    for i in range(n + 1):
        t = i / n
        p = a.lerp(b, t)
        p.z -= sag * math.sin(math.pi * t) * (1 - 0.3 * t)
        pts.append(p)
    for p, q in zip(pts[:-1], pts[1:]):
        _ridge(g, mat, p, q, w, h)


def shed_roof(g: Geo, x0: float, x1: float, y_back: float, y_front: float, z_back: float, z_front: float,
              mat='roof.tile.red', fascia_mat='trim.white', fascia_h=0.30, side_overhang=0.3, tiles=True):
    """Mono-pitch roof sloping down towards +y (front), back edge against a wall."""
    a, b = x0 - side_overhang, x1 + side_overhang
    P = [Vector((a, y_back, z_back)), Vector((b, y_back, z_back)), Vector((b, y_front, z_front)), Vector((a, y_front, z_front))]
    g.polyn(mat, P, (0, z_back - z_front, y_front - y_back))
    F = [p - Vector((0, 0, fascia_h)) for p in P]
    g.polyn(fascia_mat, [F[3], F[2], P[2], P[3]], (0, 1, 0))
    g.polyn(fascia_mat, [F[0], F[3], P[3], P[0]], (-1, 0, 0))
    g.polyn(fascia_mat, [F[1], F[2], P[2], P[1]], (1, 0, 0))
    g.polyn(fascia_mat, F, (0, 0, -1))
    if tiles:
        n = int((b - a) / 0.23)
        for k in range(1, n):
            x = a + (b - a) * k / n
            p0 = Vector((x, y_back, z_back)); p1 = Vector((x, y_front, z_front))
            fwd = (p1 - p0).normalized(); side = Vector((1, 0, 0)); up = side.cross(fwd).normalized()
            if up.z < 0:
                up = -up
            r = 0.05
            rings = [[p + side * (r * math.cos(t)) + up * (r * math.sin(t)) for t in (0, math.pi / 3, 2 * math.pi / 3, math.pi)] for p in (p0, p1)]
            for q in range(3):
                mid = (rings[0][q] + rings[0][q + 1]) * 0.5 - p0
                g.polyn(mat, [rings[0][q], rings[0][q + 1], rings[1][q + 1], rings[1][q]], mid)


def flat_roof(g: Geo, poly2d, z: float, parapet_h: float = 0.9, parapet_t: float = 0.2,
              mat='roof.flat.grey', parapet_mat='wall.render.white', coping_mat='trim.white'):
    """Flat roof slab with a parapet around a CCW polygon (outer parapet face is the wall's)."""
    g.polyn(mat, [(p[0], p[1], z) for p in poly2d], (0, 0, 1))
    n = len(poly2d)
    if parapet_h <= 0:
        return
    for i in range(n):
        a = poly2d[i]; b = poly2d[(i + 1) % n]
        dx, dy = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dy)
        nx, ny = -dy / L, dx / L
        ai = (a[0] + nx * parapet_t, a[1] + ny * parapet_t); bi = (b[0] + nx * parapet_t, b[1] + ny * parapet_t)
        g.polyn(parapet_mat, [(ai[0], ai[1], z), (bi[0], bi[1], z), (bi[0], bi[1], z + parapet_h), (ai[0], ai[1], z + parapet_h)], (nx, ny, 0))
        g.polyn(coping_mat, [(a[0], a[1], z + parapet_h), (b[0], b[1], z + parapet_h), (bi[0], bi[1], z + parapet_h), (ai[0], ai[1], z + parapet_h)], (0, 0, 1))
        g.polyn(parapet_mat, [(a[0], a[1], z), (b[0], b[1], z), (b[0], b[1], z + parapet_h), (a[0], a[1], z + parapet_h)], (-nx, -ny, 0))
