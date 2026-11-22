"""Campus beyond the forecourt: footprint massing of every mapped building inside (and around) the
school polygon, and the 砚池 pond with its rock edging, inscribed stone, cascade basin and
coconut palms.

Massing is deliberately plain (white render, flat grey roofs; off-campus buildings in a neutral
'unknown' material).  Footprints are public-map; heights are photo-derived storey counts where a
photograph exists and invented otherwise - each object carries its own tag.
Data: twin/data/campus.json (from twin/tools/osm_campus.py), twin/data/yanchi.json.
"""
from __future__ import annotations
import json, math
from pathlib import Path
import numpy as np
from shapely.geometry import Polygon, Point, box
from mathutils import Matrix
from kit import Geo, area
import arch
import nature

TWIN = Path(__file__).resolve().parents[1]
C = json.loads((TWIN / 'data/campus.json').read_text())
Y = json.loads((TWIN / 'data/yanchi.json').read_text())
SITE = json.loads((TWIN / 'data/site.json').read_text())
STOREY = 3.4

# buildings modelled in detail elsewhere (Teaching Block 1 and its two links)
SKIP = {'w1165596682@1', 'w1165596684@1', 'w1165596685@1'}
# storey counts read on photographs (others: invented)
KNOWN = {
    '2号教学楼': (5, 'photo-derived', 'five storeys of corridors on campus_erhao'),
    '科学馆': (6, 'photo-derived', 'six storeys with balcony bands on campus_kexue'),
    '第3教学楼': (6, 'photo-derived', 'six storeys or more on campus_sanhao_sihao'),
    '凤栖堂': (1, 'photo-derived', 'single-storey hall with a green glazed hip roof and red columns on campus_fengqitang'),
    '衍林堂': (1, 'estimated', 'hall assumed similar to 凤栖堂 (green glazed roof, red columns)'),
    '体育馆': (3, 'invented', 'sports hall; height not photographed'),
}
HALLS = {'凤栖堂', '衍林堂'}


def ccw(poly):
    P = Polygon(poly)
    pts = list(P.exterior.coords)[:-1]
    return pts if P.exterior.is_ccw else pts[::-1]


def massing(g, pts, h, z0, wall, roof, parapet=1.0):
    g.prism(wall, pts, z0, z0 + h, top=False)
    # flat roof inset by the parapet thickness, parapet walls
    P = Polygon(pts)
    inner = P.buffer(-0.25, join_style='mitre')
    if inner.is_empty or inner.geom_type != 'Polygon':
        area(g, roof, P, z0 + h)
        return
    ring_area = P.difference(inner)
    area(g, wall, ring_area, z0 + h + parapet)
    area(g, roof, inner, z0 + h)
    ip = list(inner.exterior.coords)[:-1]
    if not inner.exterior.is_ccw:
        ip = ip[::-1]
    # inner faces of the parapet (facing inwards)
    for a, b in zip(ip, ip[1:] + ip[:1]):
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dy)
        if L < 1e-6:
            continue
        g.polyn(wall, [(a[0], a[1], z0 + h), (b[0], b[1], z0 + h), (b[0], b[1], z0 + h + parapet), (a[0], a[1], z0 + h + parapet)], (-dy / L, dx / L, 0))
    P2 = ccw(pts)
    for a, b in zip(P2, P2[1:] + P2[:1]):
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dy)
        if L < 1e-6:
            continue
        g.polyn(wall, [(a[0], a[1], z0 + h), (b[0], b[1], z0 + h), (b[0], b[1], z0 + h + parapet), (a[0], a[1], z0 + h + parapet)], (dy / L, -dx / L, 0))


def hall(g, pts, z0):
    """Single-storey hall: white walls, red columns implied by a dark band, green hip roof over the
    footprint's oriented bounding rectangle."""
    P = Polygon(pts)
    mrr = P.minimum_rotated_rectangle
    cs = list(mrr.exterior.coords)[:4]
    e0 = np.subtract(cs[1], cs[0]); e1 = np.subtract(cs[2], cs[1])
    ang = math.atan2(e0[1], e0[0])
    L0, L1 = np.linalg.norm(e0), np.linalg.norm(e1)
    c = np.mean(cs, axis=0)
    loc = Geo()
    hw, hd = L0 / 2 - 1.2, L1 / 2 - 1.2
    loc.box('wall.render.white', (-hw, -hd, 0), (hw, hd, 4.2), skip=('-z',))
    loc.box('stone.granite.grey', (-hw - 1.2, -hd - 1.2, 0), (hw + 1.2, hd + 1.2, 0.45), skip=('-z',))
    for sx in np.linspace(-hw - 0.6, hw + 0.6, max(3, int(L0 / 3.6))):
        for sy in (-hd - 0.6, hd + 0.6):
            arch.square_column(loc, 'paint.red.column', sx, sy, 0.32, 0.45, 4.6)
    arch.hip_roof(loc, -hw - 0.6, -hd - 0.6, hw + 0.6, hd + 0.6, 4.6, 30, overhang=1.0, mat='roof.tile.green', fascia_mat='trim.white',
                  concave=0.12, upturn=0.35, upturn_len=2.0, ridge_mat='trim.white', ridge_ends=0.25, tile_pitch=0.22)
    M = Matrix.Translation((c[0], c[1], z0)) @ Matrix.Rotation(ang, 4, 'Z')
    g.merge(loc, M)


def pond(groups):
    """砚池: OSM outline; water 0.45 m below the surrounding ground, stone edging, rockery,
    inscribed upright stone, raised round cascade basin, coconut palms."""
    w = next(w for w in C['water'] if w['name'] == '砚池')
    P = Polygon(w['poly'])
    zg = SITE['levels']['ground']
    zw = zg - Y['water_depth_below_ground']
    g = Geo()
    # basin walls (dark wet stone) and bed, water surface
    pts = ccw(w['poly'])
    for a, b in zip(pts, pts[1:] + pts[:1]):
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dy)
        if L < 1e-6:
            continue
        g.polyn('stone.rock.boulder', [(a[0], a[1], zw - 0.6), (b[0], b[1], zw - 0.6), (b[0], b[1], zg), (a[0], a[1], zg)], (-dy / L, dx / L, 0))
    area(g, 'ground.soil', P, zw - 0.6)
    water = Geo()
    area(water, 'water.pond', P, zw)
    groups['yanchi.basin'] = (g, Y['tag'], Y['basis'], None)
    groups['yanchi.water'] = (water, Y['tag'], 'water surface 0.45 m below the paths (estimated)', None)
    # stone edging: boulders along the shoreline (seeded; not the real stones)
    rng = np.random.default_rng(1957)
    edge = Geo()
    ring = P.exterior
    n = int(ring.length / Y['edging_spacing'])
    for i in range(n):
        p = ring.interpolate(i / n, normalized=True)
        s = rng.uniform(0.8, 1.5)
        b = nature.boulder(int(rng.integers(1e6)), (s * 1.2, s * 0.9, s * 0.85), res=0.08, mat='stone.rock.yellow')
        M = Matrix.Translation((p.x, p.y, zw - 0.2)) @ Matrix.Rotation(rng.uniform(0, 6.28), 4, 'Z')
        edge.merge(b, M)
    groups['yanchi.edging'] = (edge, 'invented', 'natural stone edging seen on campus_yanchi / wenhua_yanchi; individual stones procedural', 40.0)
    # rockery + cascade basin
    rk = Geo()
    for spec in Y['rockery']:
        b = nature.boulder(spec['seed'], tuple(spec['size']), res=0.06, mat='stone.rock.yellow', lean=tuple(spec.get('lean', (0.1, 0.0))))
        rk.merge(b, Matrix.Translation((spec['xy'][0], spec['xy'][1], zg - 0.3)) @ Matrix.Rotation(math.radians(spec.get('rot', 0)), 4, 'Z'))
    cb = Y['cascade']
    cx, cy = cb['xy']
    rk.cylinder('stone.granite.dark', (cx, cy), cb['r'], zw, zg + cb['h'], seg=40, top=False)
    rk.cylinder('water.pond', (cx, cy), cb['r'] - 0.15, zw, zg + cb['h'] - 0.05, seg=40, top=True)
    groups['yanchi.rockery'] = (rk, Y['rockery_tag'], Y['rockery_basis'], 40.0)
    # inscribed stone
    st = Y['stone']
    sg = nature.boulder(st['seed'], tuple(st['size']), res=0.04, mat='stone.rock.boulder', lean=(0.02, 0.0))
    sx, sy = st['xy']
    groups['yanchi.stone'] = (sg.transformed(Matrix.Translation((sx, sy, zg - 0.05)) @ Matrix.Rotation(math.radians(st['rot_deg']), 4, 'Z')),
                              st['tag'], st['basis'], 50.0)
    # coconut palms
    pg = Geo()
    for i, pl in enumerate(Y['palms']['positions']):
        pg.merge(nature.coconut_palm(pl[0], pl[1], zg, height=pl[2], seed=300 + i, lean=(pl[3], pl[4])))
    groups['yanchi.palms'] = (pg, Y['palms']['tag'], Y['palms']['basis'], 40.0)
    return dict(text=dict(text=st['text'], size=0.55, extrude=0.01, mat='paint.red.inscription', font='cjk',
                          M=Matrix.Translation((sx + st['text_offset'][0], sy + st['text_offset'][1], zg + st['text_offset'][2]))
                          @ Matrix.Rotation(math.radians(st['rot_deg']), 4, 'Z') @ Matrix(((-1, 0, 0, 0), (0, 0, 1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))))


def build(coll):
    import bpy
    from build import text_mesh
    zg = SITE['levels']['ground']
    ext = box(*SITE['extent'])
    groups = {}
    school = Geo(); halls = Geo(); other = Geo()
    tags = {'campus.massing.school': [], 'campus.massing.context': []}
    n = 0
    for b in C['buildings']:
        if b['record'] in SKIP:
            continue
        pts = ccw(b['poly'])
        P = Polygon(pts)
        if P.area < 15 or not P.is_valid:
            continue
        if P.intersection(ext).area > 0.5 * P.area:
            continue           # inside the detailed forecourt area (none expected)
        name = b.get('name')
        if name in HALLS:
            hall(halls, pts, zg)
            continue
        if b['in_school']:
            st, tag, basis = KNOWN.get(name, (4, 'invented', 'storey count not documented'))
            massing(school, pts, st * STOREY + 0.6, zg, 'wall.render.white', 'roof.flat.grey')
            tags['campus.massing.school'].append(f"{name or b['record'] or b['dataset']}: {st} storeys ({tag})")
        else:
            massing(other, pts, 7 * STOREY, zg, 'unknown.massing', 'unknown.massing', parapet=0.6)
        n += 1
    groups['campus.massing.school'] = (school, 'public-map/invented', 'footprints from OSM / ODbL footprint dataset; heights: ' + '; '.join(tags['campus.massing.school'][:40]), None)
    groups['campus.halls'] = (halls, 'public-map/estimated', '凤栖堂 and 衍林堂: OSM footprints, single-storey green-roofed halls (campus_fengqitang); detail generic', None)
    groups['campus.massing.context'] = (other, 'public-map/invented', 'buildings outside the school polygon: footprints only, 7 storeys assumed, neutral material', None)
    text = pond(groups)
    nf = 0
    for name, (g, tag, basis, smooth) in groups.items():
        if not g.faces:
            continue
        ob = g.to_object(name, coll, smooth_angle=smooth)
        ob['haiz_tag'] = tag
        ob['haiz_basis'] = basis
        nf += len(g.faces)
    me = text_mesh(text['text'], 'campus.yanchi.text')
    ob = bpy.data.objects.new('campus.yanchi.inscription', me)
    coll.objects.link(ob)
    ob.matrix_world = text['text']['M']
    ob['haiz_text'] = text['text']['text']
    ob['haiz_tag'] = 'documented'
    ob['haiz_basis'] = 'red characters 砚池 on the upright stone (campus_yanchi, wenhua_yanchi); typeface substituted, stone shape procedural'
    return dict(faces=nf, buildings=n)
