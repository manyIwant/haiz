"""Teaching Block 1 (一号教学楼) — parametric reconstruction.

Reads twin/data/buildings/yihao.json.  Geometry is produced in the building-local frame
(origin = portal centre on the central block's front wall at ±0.00, +y out of the front).
Windows are emitted as instances of a few prototypes so later passes can instance / LOD them.
Raised lettering is emitted as text requests that the driver turns into meshes.

Part layout (west to east): pavilion, wing (6 bays), tower, central block (3 bays) with the
porch in front, tower, wing, pavilion.  Each part keeps its evidence tag from the spec.
"""
from __future__ import annotations
import json, math
from pathlib import Path
from mathutils import Matrix, Vector
from kit import Geo, seg_frame
import arch

TWIN = Path(__file__).resolve().parents[1]
SPEC = json.loads((TWIN / 'data/buildings/yihao.json').read_text())
PARTS = SPEC['parts']
F1 = SPEC['levels']['storeys']['f1']
FU = SPEC['levels']['storeys']['upper']


def lvl(n):
    """z of the floor of storey n (1-based); lvl(n+1) is the top of storey n."""
    return 0.0 if n <= 1 else F1 + (n - 2) * FU


WALL = 'wall.render.white'
GRAN = 'stone.granite.dark'
TRIM = 'trim.white'
ROOF = 'roof.tile.red'
STEP = 'stone.granite.red'
CW = PARTS['central']['window']
WW, WH, WSILL = PARTS['wings']['window']['w'], PARTS['wings']['window']['h'], PARTS['wings']['window']['sill']
ARCH = PARTS['towers']['arch']
ENT_H = PARTS['wings']['entablature_h']
ENT_CAP = [(-0.45, 0.0), (-0.55, 0.05), (-0.55, 0.16), (0.0, 0.16)]     # cap moulding on the granite entablature
# text/curve local frame -> building: reading direction along -x, glyph up = +z, face normal = +y (front)
FACING_PLUS_Y = Matrix(((-1, 0, 0, 0), (0, 0, 1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))


class Out:
    """Collects building geometry, window instances, text requests and evidence tags."""

    def __init__(self):
        self.g: dict[str, Geo] = {}
        self.inst: list[tuple[str, Matrix, str]] = []
        self.protos: dict[str, Geo] = {}
        self.texts: list[dict] = []
        self.tags: dict[str, dict] = {}

    def geo(self, part, tag=None, basis=None):
        if part not in self.tags and tag:
            self.tags[part] = {'tag': tag, 'basis': basis or ''}
        return self.g.setdefault(part, Geo())

    def window(self, part, proto, M):
        self.inst.append((proto, M, part))


def protos(out: Out):
    W = arch.window_unit
    out.protos.update({
        'w_up':        W(WW, WH, cols=4, transom=0.68, curtain=0.5),
        'w_f2':        W(WW, WH, cols=4, transom=0.68, curtain=0.4),
        'w_f1':        W(WW, 2.5, cols=4, transom=0.76, frame_mat='frame.alu.brown', curtain=0.3),
        'w_wide':      W(CW['w'], CW['h'], cols=6, transom=0.62, curtain=0.5),
        'w_wide_top':  W(CW['w'], CW['top_storey']['h'], cols=6, transom=0.70, curtain=0.5),
        'w_wide_bars': W(CW['w'], CW['h'], cols=6, transom=0.62, curtain=0.4, bars=0.62),
        'w_tower':     W(1.4, 1.6, cols=2, transom=0.5, frame_mat='frame.alu.grey', sill_mat='stone.granite.grey'),
        'w_arch':      W(ARCH['w'], ARCH['h'], cols=3, arch=True, transom=None),
        'w_pav':       W(1.6, 1.5, cols=2, transom=0.6),
        'w_side':      W(2.4, 1.8, cols=3, transom=0.68, curtain=0.4),
        'w_rear':      W(2.4, 1.6, cols=3, transom=0.68, curtain=0.3),
        'door':        W(2.4, 3.0, cols=4, transom=0.78, sill=0.0, frame_mat='frame.alu.grey'),
    })


def facade(out: Out, part: str, p0, p1, z0, z1, openings, mat=WALL, t=0.25, y=0.0, surround=None, reveal_mat=None):
    """Punched wall p0->p1 (CCW footprint order, exterior on the right).  openings: (x0, x1, zb, zt, proto)."""
    M, L = seg_frame(p0, p1)
    g = Geo()
    arch.wall_with_openings(g, mat, L, z0, z1, [o[:4] for o in openings], t=t, reveal_mat=reveal_mat or mat, y=y)
    for x0, x1, zb, zt, proto in openings:
        if surround:
            arch.surround(g, surround, x0, x1, zb, zt, y=y)
        if proto:
            out.window(part, proto, M @ Matrix.Translation((x0, y, zb)))
    out.geo(part).merge(g, M)
    return M, L


def local(out: Out, part: str, p0, p1, build):
    """Run build(g, L, M) in the facade-local frame of p0->p1 and merge into part."""
    M, L = seg_frame(p0, p1)
    g = Geo()
    build(g, L, M)
    out.geo(part).merge(g, M)
    return M, L


def tag_of(key):
    d = PARTS.get(key) or SPEC.get(key) or {}
    return d.get('tag', 'estimated'), d.get('basis', '')


# --------------------------------------------------------------------------------------
def wing(out: Out, s: int):
    """s = -1 west wing, +1 east wing: 6 bays, granite colonnade on storeys 1-2."""
    Wg = PARTS['wings']
    xa, xb = sorted((s * Wg['x'][0], s * Wg['x'][1]))
    y0, y1 = Wg['y']
    n = Wg['bays']
    zt = lvl(7)
    part = 'wing_' + ('w' if s < 0 else 'e')
    out.geo(part, *tag_of('wings'))
    L = xb - xa
    bay = L / n
    zent = lvl(3) + 0.1 - ENT_H
    inset = 0.45
    ops = []
    for b in range(n):
        cx = (b + 0.5) * bay
        for st in range(3, 7):
            zb = lvl(st) + WSILL
            ops.append((cx - WW / 2, cx + WW / 2, zb, zb + WH, 'w_up'))
    M, _ = facade(out, part, (xb, y1), (xa, y1), lvl(3) + 0.1, zt, ops, surround=TRIM)

    def front(g, L, M):
        ops2 = []
        for b in range(n):
            cx = (b + 0.5) * bay
            ops2.append((cx - WW / 2, cx + WW / 2, 0.8, 0.8 + 2.5, 'w_f1'))
            ops2.append((cx - WW / 2, cx + WW / 2, lvl(2) + WSILL, min(lvl(2) + WSILL + WH, zent - 0.15), 'w_f2'))
        arch.wall_with_openings(g, WALL, L, 0.5, zent, [o[:4] for o in ops2], t=0.25, y=inset)
        g.box(GRAN, (0, inset - 0.03, 0.0), (L, inset, 0.5), skip=('+y', '-z'))
        for x0_, x1_, zb, zt_, proto in ops2:
            out.window(part, proto, M @ Matrix.Translation((x0_, inset, zb)))
        for b in range(n + 1):
            x = b * bay
            w = 1.1
            g.box(GRAN, (max(0.0, x - w / 2), -0.25, 0.0), (min(L, x + w / 2), inset, zent), skip=('+y', '-z'))
        g.box(GRAN, (0, -0.45, zent), (L, inset, lvl(3) + 0.1), skip=('+y', '+z'))
        arch.cornice(g, GRAN, 0, L, lvl(3) + 0.1, ENT_CAP)
        for b in range(n + 1):
            x = min(max(b * bay, 0.45), L - 0.45)
            arch.pilaster(g, TRIM, x, 0.9 if b in (0, n) else PARTS['wings']['pilaster_w'], 0.15, lvl(3) + 0.26, zt - 0.02, cap=0.45)
        arch.cornice(g, TRIM, 0, L, zt, arch.CORNICE_EAVE)
    local(out, part, (xb, y1), (xa, y1), front)

    # rear (courtyard) facade: invented corridor elevation
    ops = []
    for b in range(n):
        cx = (b + 0.5) * bay
        for st in range(1, 7):
            zb = lvl(st) + (0.9 if st > 1 else 1.0)
            ops.append((cx - 1.2, cx + 1.2, zb, zb + 1.6, 'w_rear'))
    facade(out, part + '_rear', (xa, y0), (xb, y0), 0.0, zt, ops)
    out.tags[part + '_rear'] = {'tag': 'invented', 'basis': SPEC['rear']['basis']}

    def rear_bands(g, L, M):
        for st in range(2, 7):
            arch.band(g, TRIM, 0, L, lvl(st) - 0.05, lvl(st) + 0.15, 0.08)
        arch.cornice(g, TRIM, 0, L, zt, arch.CORNICE_EAVE)
    local(out, part + '_rear', (xa, y0), (xb, y0), rear_bands)

    g = out.geo(part)
    R = SPEC['roofs']['wing']
    g.box(WALL, (xa, y0, zt), (xb, y1, zt + 0.5), skip=('-z', '-x', '+x'))
    arch.hip_roof(g, xa, y0, xb, y1, zt + 0.5, R['pitch'], overhang=R['overhang'],
                  concave=R['concave'], upturn=R['upturn'], ridge_mat=TRIM, tiles=True)


def tower(out: Out, s: int):
    """Granite stair towers framing the central block."""
    T = PARTS['towers']
    xa, xb = sorted((s * T['x'][0], s * T['x'][1]))
    y0, y1 = T['y']
    part = 'tower_' + ('w' if s < 0 else 'e')
    out.geo(part, *tag_of('towers'))
    zg = lvl(5) + 1.5                       # granite shaft top = cornice bottom (photo-derived)
    zc = lvl(8)
    ztop = zc + 0.75
    W = xb - xa
    # stair-landing windows sit ~0.4 storey below the floor windows (campus_yihao)
    ops = [(W / 2 - 0.7, W / 2 + 0.7, lvl(st) - 0.35, lvl(st) + 1.25, 'w_tower') for st in range(2, 6)]
    M, L = facade(out, part, (xb, y1), (xa, y1), 0.0, zg, ops, mat=GRAN, t=0.3)
    CORN = [(0.0, 0.0), (-0.12, 0.0), (-0.12, 0.40), (-0.38, 0.62), (-0.38, 1.00), (-0.30, 1.10), (0.0, 1.10)]
    a_sill = lvl(5) + 2.9

    def upper(g, L, M):
        arch.arched_opening_wall(g, WALL, L, zg, ztop, L / 2 - ARCH['w'] / 2, ARCH['w'], a_sill, ARCH['h'], y=0.12)
        g.polyn(WALL, [(0, 0.0, zg), (0, 0.12, zg), (0, 0.12, ztop), (0, 0.0, ztop)], (-1, 0, 0))
        g.polyn(WALL, [(L, 0.0, zg), (L, 0.12, zg), (L, 0.12, ztop), (L, 0.0, ztop)], (1, 0, 0))
        arch.cornice(g, GRAN, -0.38, L + 0.38, zg, CORN)
        arch.louvre_box(g, L * 0.14, L * 0.86, ztop - 2.3, ztop - 0.35, depth=0.25, y=0.12)
        arch.cornice(g, TRIM, -0.05, L + 0.05, ztop - 0.3, [(0.0, 0.0), (-0.06, 0.0), (-0.06, 0.08), (-0.16, 0.16), (-0.16, 0.30), (0.0, 0.30)])
    local(out, part, (xb, y1), (xa, y1), upper)
    out.window(part, 'w_arch', M @ Matrix.Translation((L / 2 - ARCH['w'] / 2, 0.12, a_sill)))

    # side faces (granite below zg, white above) with the cornice returned along them
    g = out.geo(part)
    for px, nx in ((xa, -1), (xb, 1)):
        g.polyn(GRAN, [(px, y0, 0), (px, y1, 0), (px, y1, zg), (px, y0, zg)], (nx, 0, 0))
        g.polyn(WALL, [(px, y0, zg), (px, y1 - 0.12, zg), (px, y1 - 0.12, ztop), (px, y0, ztop)], (nx, 0, 0))
        # cornice returned along the exposed front 1.6 m of each side
        ylo = y1 - 1.6
        q0, q1 = ((xa, ylo), (xa, y1)) if nx < 0 else ((xb, y1), (xb, ylo))
        Ms, Ls = seg_frame(q0, q1)
        gs = Geo()
        arch.cornice(gs, GRAN, 0, Ls, zg, CORN, returns=False)
        g.merge(gs, Ms)
    arch.flat_roof(g, [(xa, y0), (xb, y0), (xb, y1 - 0.12), (xa, y1 - 0.12)], ztop, parapet_h=0.0)
    # rear face outside the central block
    C = PARTS['central']['x'][1]
    ra, rb = sorted((s * C, s * T['x'][1]))
    facade(out, part, (ra, y0), (rb, y0), 0.0, ztop,
           [((rb - ra) / 2 - 0.6, (rb - ra) / 2 + 0.6, lvl(st) + 1.0, lvl(st) + 2.4, 'w_pav') for st in range(1, 8)])


def central(out: Out):
    C = PARTS['central']
    xa, xb = C['x']
    fa, fb = C['front_visible_x']
    y0, y1 = C['y']
    part = 'central'
    out.geo(part, *tag_of('central'))
    zt = lvl(8)
    L = fb - fa
    bay = C['bay']
    centres = [fb - x for x in (bay, 0.0, -bay)]            # local X of the window centres (east to west)
    hw = CW['w'] / 2
    ops = []
    for cx in centres:
        for st in range(3, 8):
            if st == 7:
                zb = lvl(st) + CW['top_storey']['sill']
                ops.append((cx - hw, cx + hw, zb, zb + CW['top_storey']['h'], 'w_wide_top'))
            else:
                zb = lvl(st) + CW['sill']
                ops.append((cx - hw, cx + hw, zb, zb + CW['h'], 'w_wide_bars' if st == 3 else 'w_wide'))
    M, _ = facade(out, part, (fb, y1), (fa, y1), lvl(3), zt, ops, surround=TRIM)
    hall_w = SPEC['porch']['through_hall']['x'][1]

    def deco(g, L, M):
        for x in (fb - bay / 2, fb + bay / 2):
            arch.pilaster(g, TRIM, x, 1.0, 0.18, lvl(3), zt - 0.05)
        for st in range(4, 8):
            arch.band(g, TRIM, 0, L, lvl(st) - 0.06, lvl(st) + 0.10, 0.06)
        arch.cornice(g, TRIM, 0, L, zt, arch.CORNICE_DEEP, returns=False)
        k = 0
        x = 0.45
        while x < L - 0.3:
            g.box(TRIM, (x - 0.12, -0.42, zt - 0.38), (x + 0.12, 0.0, zt + 0.02), skip=('+y',))
            x += 1.2
        # storeys 1-2 behind the porch: granite skin, open through-hall in the middle
        hx0, hx1 = L / 2 - hall_w, L / 2 + hall_w
        ops2 = [(hx0, hx1, 0.0, 4.2, None)]
        for cx in centres:
            ops2.append((cx - hw, cx + hw, lvl(2) + CW['sill'], lvl(2) + CW['sill'] + CW['h'], 'w_wide'))
        for x0 in (0.6, L - 0.6 - 1.2):
            ops2.append((x0, x0 + 1.2, 0.0, 2.9, None))         # side doors into the towers' lobbies
        arch.wall_with_openings(g, GRAN, L, 0.0, lvl(3), [o[:4] for o in ops2], t=0.3)
        for a, b_, c, d, proto in ops2:
            if proto:
                out.window(part, proto, M @ Matrix.Translation((a, 0, c)))
        # dark door leaves in the side doors
        for x0 in (0.6, L - 0.6 - 1.2):
            g.polyn('frame.alu.grey', [(x0, 0.3, 0.0), (x0 + 1.2, 0.3, 0.0), (x0 + 1.2, 0.3, 2.9), (x0, 0.3, 2.9)], (0, -1, 0))
        g.box(GRAN, (hx0 - 0.1, -0.15, 4.2), (hx1 + 0.1, 0.0, 4.6), skip=('+y',))
    local(out, part, (fb, y1), (fa, y1), deco)

    # through-hall: open ground-floor passage to the courtyard (seen through the portal)
    g = out.geo(part)
    g.polyn('interior.ceiling', [(-hall_w, y0, 4.2), (hall_w, y0, 4.2), (hall_w, y1 + 0.3, 4.2), (-hall_w, y1 + 0.3, 4.2)], (0, 0, -1))
    g.polyn('interior.floor', [(-hall_w, y0, 0.0), (hall_w, y0, 0.0), (hall_w, y1, 0.0), (-hall_w, y1, 0.0)], (0, 0, 1))
    for sx in (-1, 1):
        g.polyn(WALL, [(sx * hall_w, y0, 0), (sx * hall_w, y1 + 0.3, 0), (sx * hall_w, y1 + 0.3, 4.2), (sx * hall_w, y0, 4.2)], (-sx, 0, 0))
        for yc in (-3.4, -7.0):
            arch.square_column(g, GRAN, sx * 3.6, yc, 0.7, 0.0, 4.2)
    # rear facade (invented) with the through-hall opening
    Lr = xb - xa
    ops = [((Lr / 2) - hall_w, (Lr / 2) + hall_w, 0.0, 4.2, None)]
    for k in range(4):
        cx = (k + 0.5) * Lr / 4
        for st in range(2, 8):
            ops.append((cx - 1.2, cx + 1.2, lvl(st) + 0.9, lvl(st) + 2.5, 'w_rear'))
    facade(out, 'central_rear', (xa, y0), (xb, y0), 0.0, zt, ops)
    out.tags['central_rear'] = {'tag': 'invented', 'basis': SPEC['rear']['basis']}
    R = SPEC['roofs']['central']
    g.box(WALL, (xa, y0, zt), (xb, y1, zt + 0.75), skip=('-z',))
    arch.hip_roof(g, xa, y0, xb, y1, zt + 0.75, R['pitch'], overhang=R['overhang'], concave=R['concave'],
                  upturn=R['upturn'], upturn_len=3.5, kick=0.25, ridge_mat=TRIM, ridge_ends=0.7, tiles=True)


def pavilion(out: Out, s: int):
    Pv = PARTS['pavilions']
    xa, xb = sorted((s * Pv['x'][0], s * Pv['x'][1]))
    y0, y1 = Pv['y']
    part = 'pav_' + ('w' if s < 0 else 'e')
    out.geo(part, *tag_of('pavilions'))
    zt = lvl(8)
    zent = lvl(3) + 0.1 - ENT_H
    Wd = xb - xa
    ops = [(Wd / 2 - 0.8, Wd / 2 + 0.8, lvl(st) + 1.0, lvl(st) + 2.5, 'w_pav') for st in range(3, 8)]
    M, _ = facade(out, part, (xb, y1), (xa, y1), lvl(3) + 0.1, zt, ops, surround=TRIM)

    def base_and_trim(g, L, M, corner_piers=True, windows=None, pilasters=(True, True)):
        ops2 = windows if windows is not None else [(L / 2 - 0.8, L / 2 + 0.8, 1.2, 2.7, 'w_pav'),
                                                    (L / 2 - 0.8, L / 2 + 0.8, lvl(2) + 1.0, lvl(2) + 2.5, 'w_pav')]
        arch.wall_with_openings(g, GRAN, L, 0.0, zent, [o[:4] for o in ops2], t=0.3)
        for o in ops2:
            out.window(part, o[4], M @ Matrix.Translation((o[0], 0, o[2])))
        if corner_piers:
            for x in (0.0, L):
                g.box(GRAN, (max(0, x - 0.6), -0.25, 0), (min(L, x + 0.6), 0, zent), skip=('+y', '-z'))
        g.box(GRAN, (0, -0.45, zent), (L, 0, lvl(3) + 0.1), skip=('+y', '+z'))
        arch.cornice(g, GRAN, 0, L, lvl(3) + 0.1, ENT_CAP)
        for x, on in zip((0.45, L - 0.45), pilasters):
            if on:
                arch.pilaster(g, TRIM, x, 0.9, 0.15, lvl(3) + 0.26, zt - 0.02, cap=0.45)
        arch.cornice(g, TRIM, -0.1, L + 0.1, zt, arch.CORNICE_EAVE)
    local(out, part, (xb, y1), (xa, y1), base_and_trim)

    Dp = y1 - y0
    xo = xb if s > 0 else xa
    p0, p1 = ((xo, y0), (xo, y1)) if s > 0 else ((xo, y1), (xo, y0))
    ops = []
    for f in (0.2, 0.5, 0.8):
        cy = Dp * f
        for st in range(3, 8):
            ops.append((cy - 1.2, cy + 1.2, lvl(st) + 0.95, lvl(st) + 2.75, 'w_side'))
    M2, _ = facade(out, part, p0, p1, lvl(3) + 0.1, zt, ops, surround=TRIM)
    win2 = []
    for f in (0.2, 0.5, 0.8):
        cy = Dp * f
        win2 += [(cy - 1.2, cy + 1.2, 1.0, 3.0, 'w_side'), (cy - 1.2, cy + 1.2, lvl(2) + 0.9, lvl(2) + 2.7, 'w_side')]
    local(out, part, p0, p1, lambda g, L, M: base_and_trim(g, L, M, windows=win2))
    # rear
    ops = [(cx - 1.2, cx + 1.2, lvl(st) + 0.9, lvl(st) + 2.5, 'w_rear') for cx in (Wd * 0.3, Wd * 0.7) for st in range(1, 8)]
    facade(out, part + '_rear', (xa, y0), (xb, y0), 0.0, zt, ops)
    out.tags[part + '_rear'] = {'tag': 'invented', 'basis': SPEC['rear']['basis']}
    # inner side: behind the wing (full height), above the wing roof, and the 0.3 m strip in front
    wy0, wy1 = PARTS['wings']['y']
    xi = xa if s > 0 else xb
    if s > 0:
        q0, q1 = (xi, wy0), (xi, y0)
    else:
        q0, q1 = (xi, y0), (xi, wy0)
    Lb = wy0 - y0
    facade(out, part + '_rear', q0, q1, 0.0, zt, [(Lb / 2 - 1.2, Lb / 2 + 1.2, lvl(st) + 0.9, lvl(st) + 2.5, 'w_rear') for st in range(1, 8)])
    if s > 0:
        facade(out, part, (xi, wy1), (xi, wy0), lvl(7), zt, [])
        facade(out, part, (xi, y1), (xi, wy1), 0.0, zt, [])
    else:
        facade(out, part, (xi, wy0), (xi, wy1), lvl(7), zt, [])
        facade(out, part, (xi, wy1), (xi, y1), 0.0, zt, [])
    g = out.geo(part)
    R = SPEC['roofs']['pavilion']
    g.box(WALL, (xa, y0, zt), (xb, y1, zt + 0.5), skip=('-z',))
    arch.hip_roof(g, xa, y0, xb, y1, zt + 0.5, R['pitch'], overhang=R['overhang'], concave=R['concave'],
                  upturn=R['upturn'], upturn_len=3.0, kick=0.2, ridge_mat=TRIM, ridge_ends=0.5, tiles=True)


def _stepped_head(g, mat, x0, x1, z_top, y_front, depth=0.35, big=(0.6, 0.35), small=(0.3, 0.3)):
    """Stepped shoulders at the top corners of a door opening (front flush with y_front)."""
    for xs, sgn in ((x0, 1), (x1, -1)):
        bw, bh = big
        sw, sh = small
        ax0, ax1 = sorted((xs, xs + sgn * bw))
        g.box(mat, (ax0, y_front - depth, z_top - bh), (ax1, y_front, z_top), skip=('+z',))
        bx0, bx1 = sorted((xs, xs + sgn * sw))
        g.box(mat, (bx0, y_front - depth, z_top - bh - sh), (bx1, y_front, z_top - bh), skip=('+z',))


def porch(out: Out):
    Pp = SPEC['porch']
    part = 'porch'
    g = out.geo(part, Pp['portal']['tag'], Pp['portal']['basis'])
    pa, pb = Pp['portal']['x']
    fy = Pp['portal']['front_y']
    pw = Pp['portal']['pier_w']
    top = Pp['portal']['top_z']
    l0, l1 = Pp['portal']['lintel']
    dep = 1.0
    for x0, x1 in ((pa, pa + pw), (pb - pw, pb)):
        g.box(GRAN, (x0, fy - dep, 0), (x1, fy, l0), skip=('-z', '+z'))
    g.box(GRAN, (pa, fy - dep, l0), (pb, fy, l1), skip=('+z',))
    g.box(GRAN, (pa - 0.3, fy - dep - 0.05, l1), (pb + 0.3, fy + 0.3, l1 + 0.22))
    g.box(GRAN, (pa - 0.18, fy - dep, l1 + 0.22), (pb + 0.18, fy + 0.18, top))
    _stepped_head(g, GRAN, pa + pw, pb - pw, l0, fy, depth=dep)
    # terrace slab over the porch, between the facade and the portal
    g.box(GRAN, (pa, 0.0, top - 0.6), (pb, fy - dep, top), skip=('-y',))
    g.polyn('interior.ceiling', [(pa + pw, 0.0, top - 0.6), (pb - pw, 0.0, top - 0.6), (pb - pw, fy - dep, top - 0.6), (pa + pw, fy - dep, top - 0.6)], (0, 0, -1))
    out.texts.append(dict(part=part, text='1923', size=1.15, extrude=0.05, mat='stone.granite.grey',
                          M=Matrix.Translation((0.0, fy + 0.05, (l0 + l1) / 2)) @ FACING_PLUS_Y))
    # canopy on four white columns standing on the terrace
    C = Pp['canopy']
    ca, cb = C['x']
    cy0, cy1 = C['y']
    zc = C['eave_z']
    cols = [(ca + 0.75, fy - 0.55), (cb - 0.75, fy - 0.55), (ca + 0.75, cy0 + 0.5), (cb - 0.75, cy0 + 0.5)]
    for cx, cy in cols:
        arch.square_column(g, TRIM, cx, cy, 0.55, top, zc - 0.62, base=0.2, cap=0.2)
    xL, xR = ca + 0.45, cb - 0.45
    yF, yB = fy - 0.25, cy0 + 0.2
    for (a0, a1) in (((xL, yF - 0.6), (xR, yF)), ((xL, yB), (xR, yB + 0.6)), ((xL, yB), (xL + 0.6, yF)), ((xR - 0.6, yB), (xR, yF))):
        g.box(TRIM, (a0[0], a0[1], zc - 0.65), (a1[0], a1[1], zc - 0.3))
    g.polyn(TRIM, [(xL, yB, zc - 0.3), (xR, yB, zc - 0.3), (xR, yF, zc - 0.3), (xL, yF, zc - 0.3)], (0, 0, -1))
    arch.hip_roof(g, ca, cy0, cb, cy1, zc, C['pitch'], overhang=C['overhang'], concave=0.08,
                  upturn=0.45, upturn_len=2.0, kick=0.2, ridge_mat=TRIM, ridge_ends=0.35, tiles=True)
    # side porches: granite side portals with stepped heads, slabs, short white columns, shed roofs
    S = Pp['side']
    for side in (-1, 1):
        xi, xo = side * S['x_inner'], side * S['x_outer']
        xa, xb = sorted((xi, xo))
        sf = S['front_y']
        pt = S['portal_top']
        zr0, zr1 = S['roof_z']
        wo = wi = ((xb - xa) - S['opening_w']) / 2
        pier_o = (xb - wo, xb) if side > 0 else (xa, xa + wo)
        pier_i = (xa, xa + wi) if side > 0 else (xb - wi, xb)
        for p in (pier_o, pier_i):
            g.box(GRAN, (p[0], sf - 0.8, 0), (p[1], sf, pt - 1.2), skip=('-z', '+z'))
        g.box(GRAN, (xa, sf - 0.8, pt - 1.2), (xb, sf, pt - 0.3), skip=('+z',))
        g.box(GRAN, (xa - 0.12, sf - 0.85, pt - 0.3), (xb + 0.12, sf + 0.15, pt))
        ox0 = pier_i[1] if side > 0 else pier_o[1]
        ox1 = pier_o[0] if side > 0 else pier_i[0]
        _stepped_head(g, GRAN, ox0, ox1, pt - 1.2, sf, depth=0.8, big=(0.35, 0.25), small=(0.18, 0.2))
        g.box(GRAN, (xa, 0.0, pt - 0.5), (xb, sf - 0.8, pt), skip=('-y',))
        for cx in ((xa + 0.45), (xb - 0.45)):
            zroof = zr0 + (zr1 - zr0) * ((sf - 0.4) / (sf + 0.6)) - 0.3
            arch.square_column(g, TRIM, cx, sf - 0.4, 0.4, pt, zroof)
        arch.shed_roof(g, xa, xb, 0.0, sf + 0.6, zr0, zr1, side_overhang=0.3)
    # porch floor, three steps down to the plaza, stainless handrails at the ends
    plaza_z = -0.45
    half = PARTS['towers']['x'][0]
    yfl = fy + 0.4
    g.box(STEP, (-half, 0.0, plaza_z), (half, yfl, 0.0), skip=('-z', '-y', '+y'))
    arch.stairs(g, STEP, -half, half, yfl, plaza_z, 0.0, n=3, tread=0.35, direction=1)
    for sx in (-1, 1):
        x = sx * (half - 0.25)
        arch.railing(g, [(x, yfl - 0.6, 0.0), (x, yfl, 0.0), (x, yfl + 1.05, plaza_z), (x, yfl + 1.4, plaza_z)], h=0.9,
                     mat='metal.steel.white', bars=0.0, post=0.7)


def links(out: Out):
    """Covered links towards the next building (white flat roofs on the Esri layer)."""
    Lk = SPEC['links']
    part = 'links'
    g = out.geo(part, Lk['tag'], Lk['basis'])
    ya, yb = Lk['y']
    for xc in Lk['x_centres']:
        x0, x1 = xc - Lk['width'] / 2, xc + Lk['width'] / 2
        for st in range(2, 8):
            z = lvl(st)
            g.box(WALL, (x0, ya, z - 0.4), (x1, yb, z))
            if st < 7:
                arch.railing(g, [(x0 + 0.1, ya, z), (x0 + 0.1, yb, z)], h=1.05, mat=TRIM, bars=0.0, posts=False)
                arch.railing(g, [(x1 - 0.1, yb, z), (x1 - 0.1, ya, z)], h=1.05, mat=TRIM, bars=0.0, posts=False)
                g.box(WALL, (x0, ya, z), (x0 + 0.2, yb, z + 1.05), skip=('-z',))
                g.box(WALL, (x1 - 0.2, ya, z), (x1, yb, z + 1.05), skip=('-z',))
        g.box('roof.flat.white', (x0 - 0.3, ya, lvl(7) - 0.4), (x1 + 0.3, yb, lvl(7) + 0.3))
        for x in (x0 + 0.25, x1 - 0.25):
            for y in (ya + 0.3, (ya + yb) / 2):
                arch.square_column(g, WALL, x, y, 0.45, 0.0, lvl(7) - 0.4)


def base_skirt(out: Out, depth=1.2):
    """Granite base below +-0.00 round the whole footprint, so the block meets the lower site levels
    (plaza 0.45 m below the floor at the front, general ground 0.9 m below at the back)."""
    from shapely.geometry import box as sbox
    from shapely.ops import unary_union
    P = PARTS
    rects = [sbox(P['central']['x'][0], P['central']['y'][0], P['central']['x'][1], P['central']['y'][1])]
    for s in (-1, 1):
        for key in ('towers', 'wings', 'pavilions'):
            x0, x1 = P[key]['x']; y0, y1 = P[key]['y']
            xa, xb = sorted((s * x0, s * x1))
            rects.append(sbox(xa, y0, xb, y1))
    fp = unary_union(rects).buffer(0.02, join_style='mitre')
    g = out.geo('base', 'estimated', 'ground floor +-0.00 sits 1.05 m above the forecourt road; the base below it is assumed to be granite-clad')
    ring = fp.exterior
    pts = list(ring.coords)
    if not ring.is_ccw:
        pts.reverse()
    for a, b in zip(pts[:-1], pts[1:]):
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = (dx * dx + dy * dy) ** 0.5
        if L < 1e-6:
            continue
        g.polyn(GRAN, [(a[0], a[1], -depth), (b[0], b[1], -depth), (b[0], b[1], 0.0), (a[0], a[1], 0.0)], (dy / L, -dx / L, 0.0))


def build():
    out = Out()
    protos(out)
    base_skirt(out)
    for s in (-1, 1):
        wing(out, s)
        tower(out, s)
        pavilion(out, s)
    central(out)
    porch(out)
    links(out)
    return out
