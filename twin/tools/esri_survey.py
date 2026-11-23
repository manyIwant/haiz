"""Read roofs and tree crowns off the repo's Esri layer (assets/cinematic/aligned/courtyard.jpg).

Writes twin/data/campus_survey.json (numbers only; no imagery leaves assets/cinematic/aligned):
  roofs   per campus footprint: the roof seen on the layer (median colour, class red-tile / light /
          dark / blue / green), sampled where the roof actually appears
  trees   tree crowns inside the school polygon outside buildings: centre, radius, a height guess
Relief displacement.  The layer is not a true orthophoto: tops of tall things lean.  On Teaching
Block 1 (eaves about 24 m, footprint known from OSM and the calibrated photographs) the red roof
appears shifted by about (+5.5, -10.8) m, i.e. LEAN = (0.23, -0.45) m per metre of height.  Roofs are
sampled at footprint + h * LEAN and crown centres are moved back by 0.75 h * LEAN.
Usage:  python twin/tools/esri_survey.py [--debug DIR]
"""
import argparse, json, math, sys
from pathlib import Path
import numpy as np, cv2
from shapely.geometry import Polygon, Point
from shapely import affinity

ROOT = Path(__file__).resolve().parents[2]
TWIN = ROOT / 'twin'
sys.path.insert(0, str(TWIN / 'py'))
sys.path.insert(0, str(TWIN / 'tools'))
from haiztwin.geo import ImageLayer, TwinFrame
from ortho import make

LEAN = (0.23, -0.45)        # metres of apparent shift per metre of height (Teaching Block 1, see above)
STOREY = 3.4
XR, YR, SC = (-260.0, 240.0), (-300.0, 160.0), 2.0     # survey window (twin metres) and oversampling


def roof_class(rgb):
    r, g, b = [float(v) for v in rgb]
    hsv = cv2.cvtColor(np.uint8([[[b, g, r]]]), cv2.COLOR_BGR2HSV)[0, 0]
    h, s, v = int(hsv[0]) * 2, int(hsv[1]), int(hsv[2])
    if s > 70 and (h < 25 or h > 335) and r > g + 20:
        return 'red-tile'
    if s > 60 and 190 < h < 260:
        return 'blue'
    if s > 50 and 70 < h < 170:
        return 'green'
    if v > 150:
        return 'light'
    return 'dark'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--debug')
    ap.add_argument('--out', default=str(TWIN / 'data/campus_survey.json'))
    a = ap.parse_args()
    fr = TwinFrame.load(); L = ImageLayer.load('courtyard')
    img, to_out, gm = make(fr, L, XR, YR, SC)            # BGR, +x right, +y up
    px_m = gm / SC                                      # metres per output pixel
    H, W = img.shape[:2]

    def mask_of(poly, dx=0.0, dy=0.0, erode=0.0):
        P = affinity.translate(Polygon(poly), dx, dy)
        if erode:
            P = P.buffer(-erode)
        m = np.zeros((H, W), np.uint8)
        if P.is_empty:
            return m
        for g in (P.geoms if P.geom_type == 'MultiPolygon' else [P]):
            cv2.fillPoly(m, [np.int32([to_out(x, y) for x, y in g.exterior.coords])], 1)
            for r in g.interiors:
                cv2.fillPoly(m, [np.int32([to_out(x, y) for x, y in r.coords])], 0)
        return m

    C = json.loads((TWIN / 'data/campus.json').read_text())
    D = json.loads((TWIN / 'data/campus_detail.json').read_text()) if (TWIN / 'data/campus_detail.json').exists() else {'buildings': {}}
    rgb = img[..., ::-1]
    roofs = {}
    built = np.zeros((H, W), np.uint8)
    for b in C['buildings']:
        rec = b['record'] or b['id']
        det = D['buildings'].get(rec, {})
        st = det.get('storeys', 1 if b['area'] < 200 else 4)
        h = st * STOREY + 0.6
        dx, dy = LEAN[0] * h, LEAN[1] * h
        m = mask_of(b['poly'], dx, dy, erode=1.2)
        built |= mask_of(b['poly']) | mask_of(b['poly'], dx, dy)
        if m.sum() < 20:
            continue
        pix = rgb[m.astype(bool)]
        med = np.median(pix, 0)
        roofs[rec] = {'rgb': [int(v) for v in med], 'class': roof_class(med), 'height_used': round(h, 1),
                      'sampled_at': [round(dx, 1), round(dy, 1)], 'pixels': int(m.sum())}

    # ---- tree crowns: dark, saturated green, textured; inside the school; outside buildings and their leaning roofs
    school = mask_of(C['school']['poly'])
    f = img.astype(np.float32)
    B, G, R = f[..., 0], f[..., 1], f[..., 2]
    exg = 2 * G - R - B
    v = f.max(2)
    tex = cv2.blur(np.abs(cv2.Laplacian(cv2.GaussianBlur(f.mean(2), (0, 0), 0.8), cv2.CV_32F)), (9, 9))
    veg = (exg > 18) & (v < 150) & (tex > 3.0)
    veg &= school.astype(bool) & ~cv2.dilate(built, np.ones((5, 5), np.uint8)).astype(bool)
    veg = cv2.morphologyEx(veg.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    veg = cv2.morphologyEx(veg, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    dist = cv2.distanceTransform(veg, cv2.DIST_L2, 5) * px_m
    from skimage.feature import peak_local_max
    peaks = peak_local_max(dist, min_distance=int(3.0 / px_m), threshold_abs=1.6, exclude_border=False)
    T = json.loads((TWIN / 'data/trees.json').read_text())
    existing = [(t['trunk_xy'], t['crown_r']) for t in T.get('broadleaf', [])] + [(T['lanren']['trunk_xy'], 14.0)]
    lanren_env = Polygon(T['lanren']['envelope']['poly'])
    trees = []
    for (Y, X) in peaks:
        r = float(dist[Y, X])
        x = XR[0] + X * px_m; y = YR[1] - Y * px_m
        r = min(r * 1.15, 9.0)                       # the distance to the mask edge under-reads a round crown a little
        h = min(4.0 + 1.6 * r, 20.0)                 # tropical broadleaf: crown radius 2-9 m -> 7-18 m tall (guess)
        x -= 0.75 * h * LEAN[0]; y -= 0.75 * h * LEAN[1]
        if any(math.hypot(x - p[0], y - p[1]) < cr + 2 for p, cr in existing) or lanren_env.contains(Point(x, y)):
            continue
        trees.append([round(x, 1), round(y, 1), round(r, 1), round(h, 1)])
    trees.sort()
    out = {
        'schema': 'haiz-twin-campus-survey/1',
        'source': 'assets/cinematic/aligned/courtyard.jpg (Esri World Imagery export kept in the repo, ~0.55 m/px, capture date unknown); '
                  'read by twin/tools/esri_survey.py, numbers only',
        'lean_m_per_m': LEAN,
        'lean_basis': 'Teaching Block 1: red roof eaves (about 24 m) appear at y -30..-10 and x -50..+65 on the layer against the OSM / '
                      'photo-calibrated body y -18.5..2.5, x -56..59 (plus 1 m eaves)',
        'roof_tag': 'public-map', 'roof_basis': 'median colour of the roof where it appears on the layer (footprint shifted by its height x lean, eroded 1.2 m)',
        'roofs': roofs,
        'tree_tag': 'public-map/invented',
        'tree_basis': 'crown centres and radii from a vegetation mask (excess green, dark, textured) of the layer inside the school polygon, '
                      'outside buildings and their leaning roofs, local maxima of the distance to the mask edge at least 3 m apart; '
                      'centres moved back by 0.75 x height x lean; heights are a guess from the radius; species and form invented. '
                      'Trees already modelled near the forecourt are left out.',
        'trees_xyrh': trees,
    }
    Path(a.out).write_text(json.dumps(out, ensure_ascii=False, indent=None, separators=(',', ':')).replace('],[', '],\n['))
    print(len(roofs), 'roofs;', len(trees), 'trees')
    if a.debug:
        dbg = Path(a.debug); dbg.mkdir(parents=True, exist_ok=True)
        ov = img.copy()
        ov[veg.astype(bool)] = (ov[veg.astype(bool)] * 0.5 + np.array([0, 255, 0]) * 0.5).astype(np.uint8)
        for x, y, r, h in trees:
            X, Y = to_out(x, y)
            cv2.circle(ov, (int(X), int(Y)), int(r / px_m), (0, 255, 255), 1)
        for b in C['buildings']:
            rec = b['record'] or b['id']
            if rec in roofs:
                q = roofs[rec]; dx, dy = q['sampled_at']
                cv2.polylines(ov, [np.int32([to_out(x + dx, y + dy) for x, y in b['poly']])], True,
                              {'red-tile': (0, 0, 255), 'light': (255, 255, 255), 'dark': (60, 60, 60), 'blue': (255, 0, 0), 'green': (0, 160, 0)}[q['class']], 2)
        cv2.imwrite(str(dbg / 'survey.jpg'), ov, [cv2.IMWRITE_JPEG_QUALITY, 85])


if __name__ == '__main__':
    main()
