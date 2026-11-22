"""Forecourt of Teaching Block 1, the main axis road and the street at the North Gate.

Twin frame, metres; z = 0 at the forecourt road in front of Teaching Block 1.  Levels (all
'estimated'; see twin/data/site.json): road 0.00, general ground and lawns 0.15, forecourt and side
plazas 0.60 (four 0.15 m risers from the road), Teaching Block 1 ground floor 1.05.
Every zone carries an evidence tag that ends up on its Blender object / glTF node.
"""
from __future__ import annotations
import json, math, random
from pathlib import Path
import shapely
from shapely.geometry import Polygon, box, LineString, Point
from shapely.ops import unary_union
from mathutils import Matrix
from kit import Geo, area, drops
import arch
import nature

TWIN = Path(__file__).resolve().parents[1]
SITE = json.loads((TWIN / 'data/site.json').read_text())
LV = SITE['levels']


def geom(spec):
    """Zone geometry from site.json: {'box': [x0,y0,x1,y1]} | {'poly': [[x,y],...]} | {'line': [...], 'width': w}
    | {'union': [...]} | {'diff': [a, b...]}, with optional 'round' (fillet radius of convex corners)."""
    if 'box' in spec:
        g = box(*spec['box'])
    elif 'poly' in spec:
        g = Polygon(spec['poly'])
    elif 'line' in spec:
        g = LineString(spec['line']).buffer(spec['width'] / 2, cap_style='flat', join_style='round')
    elif 'union' in spec:
        g = unary_union([geom(s) for s in spec['union']])
    elif 'diff' in spec:
        g = geom(spec['diff'][0])
        for s in spec['diff'][1:]:
            g = g.difference(geom(s))
    else:
        raise ValueError(spec)
    r = spec.get('round')
    if r:
        g = g.buffer(-r, join_style='round').buffer(r, join_style='round')
    return g


def zone_z(z):
    return LV[z['level']] + z.get('raise', 0.0)


class Zones:
    """Ordered zones; later zones win where they overlap earlier ones."""

    def __init__(self, zones):
        self.items = []
        claimed = None
        for z in reversed(zones):
            g0 = geom(z['geom'])
            g = g0 if claimed is None else g0.difference(claimed)
            claimed = g0 if claimed is None else claimed.union(g0)
            self.items.append(dict(z, shape=g, z=zone_z(z)))
        self.items.reverse()
        self.index = shapely.STRtree([it['shape'] for it in self.items])

    def level_at(self, x, y):
        p = Point(x, y)
        best = None
        for i in self.index.query(p):
            it = self.items[int(i)]
            if it['shape'].covers(p):
                best = it
        return best['z'] if best else LV['ground']


def paving_pattern(g: Geo, shape, z, kind, rng):
    """Inset squares that make the paving legible from the air and at eye level."""
    x0, y0, x1, y1 = shape.bounds
    if kind == 'diamond_dots':          # central plaza: dark dots on a 45-degree grid (aerial_campus)
        s = 1.25
        for i in range(int((x1 - x0) / s) + 2):
            for j in range(int((y1 - y0) / (s / 2)) + 2):
                cx = x0 + i * s + (s / 2 if j % 2 else 0.0)
                cy = y0 + j * (s / 2)
                if not shape.contains(Point(cx, cy).buffer(0.3)):
                    continue
                h = 0.15
                g.polyn('paving.granite.dark', [(cx, cy - h, z), (cx + h, cy, z), (cx, cy + h, z), (cx - h, cy, z)], (0, 0, 1))
    elif kind == 'stagger_light':       # side plazas: dark field, staggered rows of light 0.6 m squares (scenery_13)
        sx, sy, h = 1.8, 1.2, 0.3
        for j in range(int((y1 - y0) / sy) + 1):
            off = (sx / 2) if j % 2 else 0.0
            for i in range(int((x1 - x0) / sx) + 2):
                cx = x0 + 0.6 + off + i * sx; cy = y0 + 0.6 + j * sy
                if not shape.contains(Point(cx, cy).buffer(0.45)):
                    continue
                if rng.random() < 0.12:     # the pattern on the photographs is not perfectly regular
                    continue
                g.polyn('paving.granite.grey', [(cx - h, cy - h, z), (cx + h, cy - h, z), (cx + h, cy + h, z), (cx - h, cy + h, z)], (0, 0, 1))


# --------------------------------------------------------------------------------------
def build(coll):
    import bpy
    from build import text_mesh
    rng = random.Random(41)
    Z = Zones(SITE['zones'])
    groups = {}

    def G(name, tag='estimated', basis='', smooth=None):
        if name not in groups:
            groups[name] = [Geo(), tag, basis, smooth]
        return groups[name][0]

    for it in Z.items:
        shape = it['shape']
        if shape.is_empty:
            continue
        z = it['z']
        g = G('ground.' + it.get('group', it['id']), it.get('tag', 'estimated'), it.get('basis', ''))
        area(g, it['mat'], shape, z)
        nodrop = unary_union([geom(s) for s in it['nodrop']]) if it.get('nodrop') else None

        def lev(x, y, z=z, nodrop=nodrop):
            if nodrop is not None and nodrop.covers(Point(x, y)):
                return z                       # edge hidden behind a flight of steps: no kerb face
            return Z.level_at(x, y)
        drops(g, it.get('edge_mat', 'kerb.granite'), shape, z, lev)
        if it.get('pattern'):
            paving_pattern(g, shape, z + 0.004, it['pattern'], rng)

    # general ground over the extent, kerbs down to lower zones, and a plain context plane beyond
    ext = box(*SITE['extent'])
    allz = unary_union([it['shape'] for it in Z.items])
    base = ext.difference(allz)
    g = G('ground.base', 'invented', 'general ground level between mapped zones (verges, beds, unknown ground)')
    area(g, 'ground.lawn', base, LV['ground'])
    drops(g, 'kerb.granite', base, LV['ground'], lambda x, y: Z.level_at(x, y) if ext.contains(Point(x, y)) else LV['ground'])
    g = G('ground.context', 'invented', 'neutral ground outside the modelled extent (not the real surroundings)')
    area(g, 'ground.context', box(-1500, -1500, 1500, 1500).difference(ext), LV['ground'] - 0.02)

    # flights of steps
    for st in SITE['steps']:
        g = G('steps.' + st['id'], st['tag'], st['basis'])
        zt, zb = LV[st['from']], LV[st['to']]
        for x0, x1 in st['runs']:
            arch.stairs(g, 'stone.granite.red', x0, x1, st['y_edge'], zb, zt, n=st['risers'], tread=st['tread'],
                        direction=st.get('direction', 1), side_mat='stone.granite.red')

    # planters + hedges along the wing fronts
    for h in SITE['hedges']:
        g = G('forecourt.hedges', h.get('tag', 'estimated'), h.get('basis', ''))
        x0, y0, x1, y1 = h['box']
        z0 = LV[h['level']]
        g.box('kerb.granite', (x0, y0, z0), (x1, y1, z0 + 0.2), skip=('-z',))
        g.box('plant.hedge', (x0 + 0.08, y0 + 0.08, z0 + 0.2), (x1 - 0.08, y1 - 0.08, z0 + h['height']), skip=('-z',))

    # rock plinth, inscription and the Taihu stone
    P = SITE['taihu']
    g = G('taihu.plinth', P['tag'], P['basis'])
    x0, y0, x1, y1 = P['plinth']
    zt = P['plinth_top']
    rim = 0.14
    g.box('stone.granite.dark', (x0, y0, LV['road']), (x1, y1, zt), skip=('-z', '+z'))
    for a, b in (((x0, y0), (x1, y0 + rim)), ((x0, y1 - rim), (x1, y1)), ((x0, y0 + rim), (x0 + rim, y1 - rim)), ((x1 - rim, y0 + rim), (x1, y1 - rim))):
        g.polyn('stone.granite.dark', [(a[0], a[1], zt), (b[0], a[1], zt), (b[0], b[1], zt), (a[0], b[1], zt)], (0, 0, 1))
    g.polyn('ground.lawn', [(x0 + rim, y0 + rim, zt - 0.03), (x1 - rim, y0 + rim, zt - 0.03), (x1 - rim, y1 - rim, zt - 0.03), (x0 + rim, y1 - rim, zt - 0.03)], (0, 0, 1))
    for key in ('panel', 'panel2'):
        if key in P:
            qx0, qx1, qz0, qz1 = P[key]
            g.box('stone.granite.dark', (qx0, y1, qz0), (qx1, y1 + 0.02, qz1), skip=('-y',))
    px0, px1, pz0, pz1 = P['panel']
    FACING_PLUS_Y = Matrix(((-1, 0, 0, 0), (0, 0, 1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))
    texts = [dict(text=P['inscription'], size=0.34, extrude=0.006, mat='trim.white', font='cjk',
                  M=Matrix.Translation(((px0 + px1) / 2, y1 + 0.03, (pz0 + pz1) / 2)) @ FACING_PLUS_Y)]
    rock = nature.taihu_rock()
    rx, ry = P['rock_xy']
    M = Matrix.Translation((rx, ry, zt - 0.05)) @ Matrix.Rotation(math.radians(P.get('rock_rot_deg', 0.0)), 4, 'Z')
    groups['taihu.rock'] = [rock.transformed(M), P['rock_tag'], P['rock_basis'], 50.0]

    nface = 0
    for name, (g, tag, basis, smooth) in groups.items():
        if not g.faces:
            continue
        ob = g.to_object('site.' + name, coll, smooth_angle=smooth)
        ob['haiz_tag'] = tag
        ob['haiz_basis'] = basis
        nface += len(g.faces)
    for i, req in enumerate(texts):
        me = text_mesh(req, f'site.text.{i}')
        ob = bpy.data.objects.new('site.taihu.inscription', me)
        coll.objects.link(ob)
        ob.matrix_world = req['M']
        ob['haiz_text'] = req['text']
        ob['haiz_tag'] = P.get('inscription_tag', 'documented')
        ob['haiz_basis'] = P.get('inscription_basis', '')
    return dict(faces=nface, zones=len(Z.items))
