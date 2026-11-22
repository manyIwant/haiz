"""The North Gate (北门): a three-bay, four-pier memorial gateway with green glazed roofs, white
eave work, green key-pattern bands, ochre corner brackets, the plaque 海南中學 and four stone lions,
flanked by the boundary wall and a gatehouse.  Dimensions and evidence: twin/data/gate.json.
"""
from __future__ import annotations
import json, math
from pathlib import Path
import numpy as np
from mathutils import Matrix
from kit import Geo
import arch
import nature

TWIN = Path(__file__).resolve().parents[1]
GATE = json.loads((TWIN / 'data/gate.json').read_text())

RENDER = 'wall.render.cream'
WHITE = 'trim.white'
GREEN = 'paint.green.fret'
OCHRE = 'paint.ochre.fret'
BAND = 'sign.metal.bronze'
BASE = 'stone.granite.grey'      # light grey stone base course (hero-2560 close-up)
FACING_PLUS_Y = Matrix(((-1, 0, 0, 0), (0, 0, 1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))


def fret_band(g, x0, x1, z0, z1, yface, sign, proud=0.035):
    """Green band with a white meander (回纹) on a facade plane y = yface facing sign*y."""
    yb = yface + sign * proud
    g.box(GREEN, (x0, min(yface, yb), z0), (x1, max(yface, yb), z1), skip=('+y' if sign < 0 else '-y',))
    h = z1 - z0
    s = h * 1.15
    n = max(1, int((x1 - x0 - 0.1) / s))
    step = (x1 - x0 - 0.1) / n
    yy = yb + sign * 0.004
    nrm = (0, sign, 0)
    t = h * 0.14

    def rect(a, b, c, d):
        g.polyn(WHITE, [(a, yy, c), (b, yy, c), (b, yy, d), (a, yy, d)], nrm)
    for i in range(n):
        cx = x0 + 0.05 + (i + 0.5) * step
        a, b = cx - 0.36 * step, cx + 0.36 * step
        if i % 2 == 0:
            rect(a, b, z1 - 0.12 * h - t, z1 - 0.12 * h)
        else:
            rect(a, b, z0 + 0.12 * h, z0 + 0.12 * h + t)
        rect(b - t, b, z0 + 0.12 * h, z1 - 0.12 * h)
    # thin white rules above and below
    rect(x0 + 0.02, x1 - 0.02, z0 + 0.02, z0 + 0.02 + t * 0.5)
    rect(x0 + 0.02, x1 - 0.02, z1 - 0.02 - t * 0.5, z1 - 0.02)


def corner_bracket(g, x_pier, x_dir, z_top, w, h, yface, sign, thick=0.08):
    """Ochre corner bracket (雀替) in the angle between a pier and the beam above an opening."""
    pts = [(x_pier, z_top), (x_pier + x_dir * w, z_top), (x_pier + x_dir * w * 0.75, z_top - h * 0.22),
           (x_pier + x_dir * w * 0.35, z_top - h * 0.45), (x_pier + x_dir * 0.12, z_top - h * 0.7), (x_pier, z_top - h)]
    y0, y1 = yface, yface + sign * thick
    # front face, back face, edges
    g.polyn(OCHRE, [(x, y1, z) for x, z in pts], (0, sign, 0))
    for (xa, za), (xb, zb) in zip(pts, pts[1:] + pts[:1]):
        nx, nz = (zb - za), -(xb - xa)
        g.polyn(OCHRE, [(xa, y0, za), (xb, y0, zb), (xb, y1, zb), (xa, y1, za)], (nx * -x_dir, 0, nz * -x_dir))
    # dark green inlaid scroll line
    g.polyn(GREEN, [(x_pier + x_dir * 0.1, y1 + sign * 0.003, z_top - 0.08), (x_pier + x_dir * w * 0.7, y1 + sign * 0.003, z_top - 0.08),
                    (x_pier + x_dir * w * 0.7, y1 + sign * 0.003, z_top - 0.14), (x_pier + x_dir * 0.1, y1 + sign * 0.003, z_top - 0.14)], (0, sign, 0))


def pier(g, x0, x1, y0, y1, top, P):
    bh = P['base_h']
    g.box(BASE, (x0 - 0.06, y0 - 0.06, 0.0), (x1 + 0.06, y1 + 0.06, bh), skip=('-z',))
    g.box(RENDER, (x0, y0, bh), (x1, y1, top), skip=('-z',))
    for zb in P['bands_z']:
        if zb + P['band_h'] < top - 0.2:
            g.box(BAND, (x0 - 0.012, y0 - 0.012, zb), (x1 + 0.012, y1 + 0.012, zb + P['band_h']), skip=())


def eave_brackets(g, x0, x1, z, y_face, sign, n=None, w=0.16, h=0.32, d=0.38):
    """Row of white bracket blocks under an eave (simplified dougong)."""
    n = n or max(2, int((x1 - x0) / 0.62))
    for i in range(n):
        cx = x0 + (i + 0.5) * (x1 - x0) / n
        ya, yb = sorted((y_face, y_face + sign * d))
        g.box(WHITE, (cx - w / 2, ya, z - h), (cx + w / 2, yb, z), skip=())
        ya2, yb2 = sorted((y_face, y_face + sign * d * 0.6))
        g.box(GREEN, (cx - w * 0.3, ya2, z - h - 0.12), (cx + w * 0.3, yb2, z - h), skip=())


def gate():
    G = GATE
    P = G['piers']
    yc, dep = G['centre_y'], G['depth']
    y0, y1 = yc - dep / 2, yc + dep / 2
    g = Geo()
    xi0, xi1 = P['inner']['x']; xo0, xo1 = P['outer']['x']
    for s in (-1, 1):
        a, b = sorted((s * xi0, s * xi1)); pier(g, a, b, y0, y1, P['inner']['top'], P)
        a, b = sorted((s * xo0, s * xo1)); pier(g, a, b, y0, y1, P['outer']['top'], P)
    # ---- central bay superstructure
    C = G['central_bay']
    zt_c = P['inner']['top']
    g.box(WHITE, (-xi0, y0 + 0.05, C['beam'][0]), (xi0, y1 - 0.05, zt_c), skip=())
    for sign, yface in ((1, y1 - 0.05), (-1, y0 + 0.05)):
        fret_band(g, -xi0, xi0, C['fret_low'][0], C['fret_low'][1], yface, sign)
        fret_band(g, -xi0 - 0.4, xi0 + 0.4, C['fret_high'][0], C['fret_high'][1], yface, sign)
        # plaque: cream board, gold frame
        px0, px1 = C['plaque_x']
        pz0, pz1 = C['plaque']
        yp = yface + sign * 0.05
        ya, yb = sorted((yface, yp))
        g.box('paint.gold', (px0 - 0.07, ya, pz0 - 0.07), (px1 + 0.07, yb, pz1 + 0.07), skip=())
        yq = yp + sign * 0.006
        g.polyn(RENDER, [(px0, yq, pz0), (px1, yq, pz0), (px1, yq, pz1), (px0, yq, pz1)], (0, sign, 0))
        # corner brackets of the central opening
        corner_bracket(g, -xi0, 1, C['opening_top'], C['bracket']['w'], C['bracket']['h'], yface, sign)
        corner_bracket(g, xi0, -1, C['opening_top'], C['bracket']['w'], C['bracket']['h'], yface, sign)
    # ---- side bays
    S = G['side_bay']
    for s in (-1, 1):
        a, b = sorted((s * xi1, s * xo0))
        g.box(WHITE, (a, y0 + 0.08, S['opening_top']), (b, y1 - 0.08, P['outer']['top'] + 0.3), skip=())
        for sign, yface in ((1, y1 - 0.08), (-1, y0 + 0.08)):
            fret_band(g, a, b, S['fret_low'][0], S['fret_low'][1], yface, sign)
            fret_band(g, a, b, S['fret_high'][0], S['fret_high'][1], yface, sign)
            corner_bracket(g, a, 1, S['opening_top'], S['bracket']['w'], S['bracket']['h'], yface, sign)
            corner_bracket(g, b, -1, S['opening_top'], S['bracket']['w'], S['bracket']['h'], yface, sign)
        # fret bands also run across the outer piers' upper part (hero-2560)
        a2, b2 = sorted((s * xo0, s * xo1))
        for sign, yface in ((1, y1), (-1, y0)):
            fret_band(g, a2, b2, S['fret_high'][0], S['fret_high'][1], yface, sign)
    # ---- roofs (green glazed tiles, white fascia and ridges)
    R = G['roofs']
    rc = R['central']
    ov = rc['eave_y'] - dep / 2
    info_c = arch.hip_roof(g, -(rc['eave_x'] - ov), y0, rc['eave_x'] - ov, y1, rc['eave_z'] + 0.25, rc['pitch'], overhang=ov,
                           mat='roof.tile.green', fascia_mat=WHITE, fascia_h=0.3, concave=0.12, upturn=rc['upturn'], upturn_len=1.8,
                           kick=rc['kick'], ridge_mat=WHITE, ridge_w=0.22, ridge_h=0.28, ridge_ends=rc['ridge_ends'], tile_pitch=0.2)
    for sign, yface in ((1, y1), (-1, y0)):
        eave_brackets(g, -xi1, xi1, rc['eave_z'] + 0.25, yface, sign)
    rs = R['side']
    ovs = rs['eave_y'] - dep / 2
    for s in (-1, 1):
        xa, xb = sorted((s * (rs['x_in'] + ovs), s * (rs['x_out'] - ovs)))
        arch.hip_roof(g, xa, y0, xb, y1, rs['eave_z'] + 0.2, rs['pitch'], overhang=ovs, mat='roof.tile.green', fascia_mat=WHITE,
                      fascia_h=0.26, concave=0.12, upturn=rs['upturn'], upturn_len=1.4, kick=rs['kick'], ridge_mat=WHITE,
                      ridge_w=0.2, ridge_h=0.22, ridge_ends=0.25, tile_pitch=0.2)
        a, b = sorted((s * xi1, s * xo1))
        for sign, yface in ((1, y1), (-1, y0)):
            eave_brackets(g, a, b, rs['eave_z'] + 0.2, yface, sign, w=0.14, h=0.26, d=0.3)
    texts = [dict(text=C['text'], size=0.78, extrude=0.02, mat='paint.gold', font='cjk',
                  M=Matrix.Translation((0.0, y1 - 0.05 + 0.06 + 0.012, (C['plaque'][0] + C['plaque'][1]) / 2)) @ FACING_PLUS_Y)]
    return g, texts


def lion(seed, h=1.1, ball=True):
    """Seated guardian lion (simplified carving), facing +y, base at z = 0."""
    k = h / 1.1
    B = [(0.0, -0.08, 0.36, 0.25, 0.30, 0.28), (0.0, 0.10, 0.55, 0.22, 0.20, 0.26), (0.0, 0.12, 0.86, 0.25, 0.22, 0.21),
         (0.0, 0.02, 0.84, 0.29, 0.20, 0.27), (0.0, 0.31, 0.83, 0.12, 0.10, 0.09), (0.11, 0.22, 0.28, 0.075, 0.075, 0.27),
         (-0.11, 0.22, 0.28, 0.075, 0.075, 0.27), (0.0, 0.0, 0.08, 0.34, 0.40, 0.09), (0.15, 0.12, 1.02, 0.06, 0.05, 0.05),
         (-0.15, 0.12, 1.02, 0.06, 0.05, 0.05), (0.0, -0.32, 0.25, 0.12, 0.12, 0.15)]
    if ball:
        B.append((0.2, 0.32, 0.2, 0.1, 0.1, 0.1))
    B = [(cx * k, cy * k, cz * k, rx * k, ry * k, rz * k) for cx, cy, cz, rx, ry, rz in B]
    return nature.sdf_rock(B, (-0.5 * k, 0.5 * k, -0.55 * k, 0.55 * k, -0.02, 1.15 * k), 0.025, seed, noise=0.012, k=0.08,
                           mat='stone.granite.white')


def boundary_wall(g, pts, h, coping_h):
    """Rendered wall 0.3 m thick with a green glazed-tile coping."""
    t = 0.3
    for (xa, ya), (xb, yb) in zip(pts[:-1], pts[1:]):
        dx, dy = xb - xa, yb - ya
        L = math.hypot(dx, dy)
        nx, ny = -dy / L * t / 2, dx / L * t / 2
        quad = [(xa - nx, ya - ny), (xb - nx, yb - ny), (xb + nx, yb + ny), (xa + nx, ya + ny)]
        g.prism(RENDER, quad, 0.0, h)
        # coping: overhanging ridge
        c = 0.18
        cx_, cy_ = -dy / L * (t / 2 + c), dx / L * (t / 2 + c)
        for side in (1, -1):
            g.polyn('roof.tile.green', [(xa + side * cx_, ya + side * cy_, h), (xb + side * cx_, yb + side * cy_, h),
                                        (xb, yb, h + coping_h), (xa, ya, h + coping_h)], (side * -dy, side * dx, 1.0))
        g.polyn(WHITE, [(xa - cx_, ya - cy_, h), (xb - cx_, yb - cy_, h), (xb + cx_, yb + cy_, h), (xa + cx_, ya + cy_, h)], (0, 0, -1))


def build(coll):
    import bpy
    from build import text_mesh
    G = GATE
    objs = {}
    g, texts = gate()
    objs['gate'] = (g, G['tag'], G['basis'], None)
    # lions on pedestals
    L = G['lions']
    lg = Geo()
    pd = L['pedestal']
    for i, x in enumerate(L['x']):
        y = L['y']
        lg.box('stone.granite.white', (x - pd['w'] / 2, y - pd['d'] / 2, 0.0), (x + pd['w'] / 2, y + pd['d'] / 2, pd['h'] - 0.12), skip=('-z',))
        lg.box('stone.granite.white', (x - pd['w'] / 2 - 0.05, y - pd['d'] / 2 - 0.05, pd['h'] - 0.12), (x + pd['w'] / 2 + 0.05, y + pd['d'] / 2 + 0.05, pd['h']), skip=())
        lg.box('stone.granite.white', (x - pd['w'] / 2 - 0.06, y - pd['d'] / 2 - 0.06, 0.0), (x + pd['w'] / 2 + 0.06, y + pd['d'] / 2 + 0.06, 0.15), skip=('-z',))
        mirror = -1 if x < 0 else 1
        li = lion(40 + i, L['height'], ball=(x > 0))
        M = Matrix.Translation((x, y, pd['h'])) @ Matrix.Scale(1, 4) @ Matrix(((mirror, 0, 0, 0), (0, 1, 0, 0), (0, 0, 1, 0), (0, 0, 0, 1)))
        lg.merge(li, M)
    objs['lions'] = (lg, L['tag'], L['basis'], 50.0)
    # walls
    W = G['walls']
    wg = Geo()
    for key in ('west', 'east'):
        boundary_wall(wg, W[key], W['h'], W['coping_h'])
    objs['walls'] = (wg, W['tag'], W['basis'], None)
    # gatehouse
    H = G['gatehouse']
    hg = Geo()
    hg.box('wall.render.white', (H['x'][0], H['y'][0], 0.0), (H['x'][1], H['y'][1], H['h']), skip=('-z',))
    hg.box(BASE, (H['x'][0] - 0.03, H['y'][0] - 0.03, 0.0), (H['x'][1] + 0.03, H['y'][1] + 0.03, 0.5), skip=('-z', '+z'))
    for wx in (H['x'][0] + 1.0, H['x'][0] + 3.0):
        hg.box('glass.window', (wx, H['y'][1], 1.0), (wx + 1.4, H['y'][1] + 0.02, 2.4), skip=('-y',))
    arch.hip_roof(hg, H['x'][0], H['y'][0], H['x'][1], H['y'][1], H['h'], 30, overhang=0.7, mat='roof.tile.green', fascia_mat=WHITE,
                  fascia_h=0.25, concave=0.1, upturn=0.3, upturn_len=1.2, ridge_mat=WHITE, ridge_ends=0.2, tile_pitch=0.2)
    objs['gatehouse'] = (hg, H['tag'], H['basis'], None)
    B = G['booth']
    bg = Geo()
    bg.box('metal.steel.white', (B['x'][0], B['y'][0], 0.0), (B['x'][1], B['y'][1], B['h']), skip=('-z',))
    bg.box('glass.window', (B['x'][0] + 0.1, B['y'][1], 1.0), (B['x'][1] - 0.1, B['y'][1] + 0.01, 1.9), skip=('-y',))
    for k in range(1):                      # turnstile beside the booth
        tx = B['x'][0] - 0.25
        bg.box('metal.steel.white', (tx - 0.08, B['y'][0], 0.0), (tx + 0.08, B['y'][1], 1.0), skip=('-z',))
    objs['booth'] = (bg, B['tag'], B['basis'], None)
    nf = 0
    for name, (g, tag, basis, smooth) in objs.items():
        if not g.faces:
            continue
        ob = g.to_object('gate.' + name, coll, smooth_angle=smooth)
        ob['haiz_tag'] = tag
        ob['haiz_basis'] = basis
        nf += len(g.faces)
    for i, req in enumerate(texts):
        me = text_mesh(req, f'gate.text.{i}')
        ob = bpy.data.objects.new('gate.plaque.text', me)
        coll.objects.link(ob)
        ob.matrix_world = req['M']
        ob['haiz_text'] = req['text']
        ob['haiz_tag'] = 'documented'
        ob['haiz_basis'] = 'plaque text read on hero-2560 (海南中學, written right to left); calligraphy substituted by a sans typeface'
    return dict(faces=nf)
