"""Fetch aligned image exports for one fixed WGS84 target, retaining attribution."""
import concurrent.futures
import json
import math
from pathlib import Path
import urllib.parse
import urllib.request

# The legacy project anchor is Amap GCJ-02, not WGS84. An approximate inverse
# conversion is cross-checked against the OSM school footprint (way 1127981105).
TARGET = (19.998054573632277, 110.34282299295398)
SOURCE_TARGET = (19.996067, 110.347227)
ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'assets' / 'cinematic' / 'aligned'
DEST.mkdir(parents=True, exist_ok=True)
previous=DEST/'manifest.json'
refresh=not previous.exists() or json.loads(previous.read_text()).get('target') != dict(lat=TARGET[0],lon=TARGET[1])
R = 6378137
x = R * math.radians(TARGET[1])
y = R * math.log(math.tan(math.pi / 4 + math.radians(TARGET[0]) / 2))
SERVICE = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export'

def fetch(item):
    name, width, pixels = item
    bounds = [x-width/2, y-width/2, x+width/2, y+width/2]
    params = dict(bbox=','.join(map(str,bounds)), bboxSR=3857, imageSR=3857,
                  size=f'{pixels},{pixels}', format='jpg', f='image')
    url = SERVICE + '?' + urllib.parse.urlencode(params)
    path = DEST / (name+'.jpg')
    if refresh or not path.exists():
        with urllib.request.urlopen(url, timeout=40) as response:
            data = response.read()
        if data[:2] != b'\xff\xd8':
            raise ValueError('Expected JPEG imagery for '+name)
        path.write_bytes(data)
    return dict(name=name, path='assets/cinematic/aligned/'+name+'.jpg',
                bounds=bounds, widthMeters=width, pixels=pixels, source=url)

with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
    layers=list(executor.map(fetch,[('region',1800000,1024),('island',580000,1024),('city',85000,1024),('district',12000,1024),('campus',1800,1024),('courtyard',600,1024)]))
manifest=dict(target=dict(lat=TARGET[0],lon=TARGET[1]), targetCRS='WGS84',
 sourceTarget=dict(lat=SOURCE_TARGET[0],lon=SOURCE_TARGET[1],crs='GCJ-02'),
 coordinateNote='Approximate inverse of the legacy Amap anchor; cross-checked against OSM way 1127981105. Not a surveyed gate position.', layers=layers,
 attribution='Esri, Maxar, Earthstar Geographics, and the GIS User Community',
 notice='Existing map-service imagery, not live imagery; acquisition dates vary. The final campus model is approximate.')
(DEST/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
(DEST/'manifest.js').write_text('window.DescentImagery='+json.dumps(manifest,ensure_ascii=False)+';\n')
print(json.dumps(dict(layers=len(layers),target=manifest['target'])))
