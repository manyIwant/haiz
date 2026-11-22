"""Render a campus-aligned orthophoto (twin frame) from the repo's Esri layer, with overlays.

Usage: python twin/tools/ortho.py --x -80 80 --y -20 160 --scale 4 --out /path.png [--osm DIR] [--frame twin/data/frame.json]
The output image has +x to the right and +y up, a 5 m grid and 25 m labels. It is a research
view for digitising; it is NOT committed (the imagery stays in assets/cinematic/aligned).
"""
import argparse, json, math, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'py'))
import numpy as np, cv2
from haiztwin.geo import ImageLayer, TwinFrame, wgs_to_merc


def make(frame, layer, xr, yr, scale):
    img = cv2.imread(str(layer.path))
    gm = layer.merc_per_px * frame._k            # ground metres per source pixel
    x0, x1 = xr; y0, y1 = yr
    W = int((x1 - x0) / gm * scale); H = int((y1 - y0) / gm * scale)
    # output pixel (X, Y) -> twin (x, y) -> merc -> source px
    def src(X, Y):
        x = x0 + X / scale * gm; y = y1 - Y / scale * gm
        return layer.merc_to_px(*frame.twin_to_merc(x, y))
    p00 = src(0, 0); p10 = src(1, 0); p01 = src(0, 1)
    A = np.array([[p10[0] - p00[0], p01[0] - p00[0], p00[0]], [p10[1] - p00[1], p01[1] - p00[1], p00[1]]], np.float64)
    out = cv2.warpAffine(img, A, (W, H), flags=cv2.INTER_CUBIC | cv2.WARP_INVERSE_MAP)
    def to_out(x, y):
        return ((x - x0) / gm * scale, (y1 - y) / gm * scale)
    return out, to_out, gm


def grid(out, to_out, xr, yr, step=5):
    for xm in range(int(math.ceil(xr[0] / step) * step), int(xr[1]) + 1, step):
        X = int(round(to_out(xm, 0)[0])); maj = xm % 25 == 0
        cv2.line(out, (X, 0), (X, out.shape[0]), (0, 255, 255) if maj else (150, 150, 150), 1)
        if maj: cv2.putText(out, str(xm), (X + 2, 12), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (0, 255, 255), 1)
    for ym in range(int(math.ceil(yr[0] / step) * step), int(yr[1]) + 1, step):
        Y = int(round(to_out(0, ym)[1])); maj = ym % 25 == 0
        cv2.line(out, (0, Y), (out.shape[1], Y), (255, 255, 0) if maj else (150, 150, 150), 1)
        if maj: cv2.putText(out, str(ym), (2, Y - 2), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (255, 255, 0), 1)


def osm_overlay(out, to_out, frame, osmdir):
    import shapely.wkt
    osmdir = Path(osmdir)
    def poly(g, col, w=1):
        geoms = [g] if g.geom_type in ('Polygon', 'LineString') else list(g.geoms)
        for gg in geoms:
            coords = gg.exterior.coords if gg.geom_type == 'Polygon' else gg.coords
            pts = np.array([to_out(*frame.wgs_to_twin(lat, lon)) for lon, lat in coords], np.int32)
            cv2.polylines(out, [pts], gg.geom_type == 'Polygon', col, w, cv2.LINE_AA)
    for fn, col in [('buildings_building.json', (255, 0, 255)), ('base_land_use.json', (0, 255, 0)),
                    ('transportation_segment.json', (0, 128, 255)), ('base_infrastructure.json', (0, 0, 255))]:
        p = osmdir / fn
        if not p.exists(): continue
        for r in json.loads(p.read_text()):
            if r['sources'][0]['dataset'] != 'OpenStreetMap': continue
            g = shapely.wkt.loads(r['wkt'])
            if g.bounds[0] < 110.3 or g.bounds[2] > 110.4: continue
            poly(g, col, 1)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--x', nargs=2, type=float, default=[-80, 80])
    ap.add_argument('--y', nargs=2, type=float, default=[-20, 160])
    ap.add_argument('--scale', type=float, default=4)
    ap.add_argument('--out', required=True)
    ap.add_argument('--osm')
    ap.add_argument('--frame')
    ap.add_argument('--layer', default='courtyard')
    a = ap.parse_args()
    frame = TwinFrame.load(Path(a.frame) if a.frame else None)
    layer = ImageLayer.load(a.layer)
    out, to_out, gm = make(frame, layer, a.x, a.y, a.scale)
    grid(out, to_out, a.x, a.y)
    if a.osm: osm_overlay(out, to_out, frame, a.osm)
    cv2.imwrite(a.out, out)
    print('ground m/px', gm, 'size', out.shape[1], out.shape[0])
