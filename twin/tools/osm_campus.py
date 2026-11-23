"""Convert Overture Maps extracts (OpenStreetMap + ODbL building footprints) around the campus into
twin-frame data: twin/data/campus.json.

Usage: python twin/tools/osm_campus.py --overture DIR [--out twin/data/campus.json]

DIR holds the JSON extracts written by the Overture query (buildings_building.json,
base_land_use.json, base_water.json; release 2026-11-18.0).  Coordinates are converted with the
twin frame (twin/data/frame.json).  Data (c) OpenStreetMap contributors and the Overture Maps
Foundation, ODbL 1.0; footprints from the 'doi:10.5281/zenodo.8174931' dataset are machine-traced.
"""
import argparse, json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'py'))
import shapely.wkt
from shapely.geometry import Polygon, mapping
from shapely.ops import unary_union
from haiztwin.geo import TwinFrame

SCHOOL = '海南中学高中部'


def to_twin(fr, g):
    def ring(cs):
        return [tuple(round(v, 2) for v in fr.wgs_to_twin(lat, lon)) for lon, lat in cs]
    if g.geom_type == 'Polygon':
        return Polygon(ring(g.exterior.coords), [ring(i.coords) for i in g.interiors])
    if g.geom_type == 'MultiPolygon':
        return unary_union([to_twin(fr, p) for p in g.geoms])
    raise ValueError(g.geom_type)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--overture', required=True)
    ap.add_argument('--out', default=str(Path(__file__).resolve().parents[1] / 'data/campus.json'))
    ap.add_argument('--buffer', type=float, default=60.0, help='context ring kept around the school polygon (m)')
    a = ap.parse_args()
    fr = TwinFrame.load()
    D = Path(a.overture)
    lu = json.loads((D / 'base_land_use.json').read_text())
    school = None
    for r in lu:
        nm = (r.get('names') or {}).get('primary') if r.get('names') else None
        if nm == SCHOOL:
            school = to_twin(fr, shapely.wkt.loads(r['wkt']))
            school_id = r['sources'][0].get('record_id')
    assert school is not None, 'school polygon not found'
    keep = school.buffer(a.buffer)
    out = {
        'schema': 'haiz-twin-campus/1',
        'source': 'Overture Maps release 2026-11-18.0 (OpenStreetMap and ODbL building footprints); (c) OpenStreetMap contributors, ODbL 1.0',
        'frame': 'twin frame (metres)',
        'school': {'name': SCHOOL, 'osm': school_id, 'poly': [list(p) for p in school.exterior.coords],
                   'tag': 'public-map', 'basis': 'OSM land-use polygon of the school (amenity=school)'},
        'buildings': [], 'water': [], 'land_use': []}
    for r in json.loads((D / 'buildings_building.json').read_text()):
        g = to_twin(fr, shapely.wkt.loads(r['wkt']))
        if not g.intersects(keep):
            continue
        src = r['sources'][0]
        nm = (r.get('names') or {}).get('primary') if r.get('names') else None
        polys = [g] if g.geom_type == 'Polygon' else list(g.geoms)
        for p in polys:
            out['buildings'].append({
                'id': r['id'], 'name': nm, 'dataset': src['dataset'], 'record': src.get('record_id'),
                'in_school': bool(p.representative_point().within(school)),
                'height': r.get('height'), 'num_floors': r.get('num_floors'), 'class': r.get('class'),
                'poly': [list(c) for c in p.exterior.coords], 'area': round(p.area, 1)})
    for r in json.loads((D / 'base_water.json').read_text()):
        g = shapely.wkt.loads(r['wkt'])
        if g.geom_type not in ('Polygon', 'MultiPolygon'):
            continue
        g = to_twin(fr, g)
        if not g.intersects(keep):
            continue
        nm = (r.get('names') or {}).get('primary') if r.get('names') else None
        out['water'].append({'id': r['id'], 'name': nm, 'class': r.get('class'), 'record': r['sources'][0].get('record_id'),
                             'poly': [list(c) for c in (g if g.geom_type == 'Polygon' else max(g.geoms, key=lambda q: q.area)).exterior.coords],
                             'area': round(g.area, 1)})
    for r in lu:
        g = shapely.wkt.loads(r['wkt'])
        if g.geom_type not in ('Polygon', 'MultiPolygon'):
            continue
        g = to_twin(fr, g)
        if not g.intersects(keep) or g.area > 50000:
            continue
        nm = (r.get('names') or {}).get('primary') if r.get('names') else None
        out['land_use'].append({'id': r['id'], 'name': nm, 'class': r.get('class'), 'subtype': r.get('subtype'),
                                'record': r['sources'][0].get('record_id'),
                                'poly': [list(c) for c in (g if g.geom_type == 'Polygon' else max(g.geoms, key=lambda q: q.area)).exterior.coords]})
    Path(a.out).write_text(json.dumps(out, ensure_ascii=False, indent=None, separators=(',', ':')))
    print('school area', round(school.area), 'buildings', len(out['buildings']), 'in school', sum(b['in_school'] for b in out['buildings']),
          'water', len(out['water']), 'land use', len(out['land_use']))


if __name__ == '__main__':
    main()
