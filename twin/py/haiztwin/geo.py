"""Coordinate frames used by the twin.

Frames
------
wgs84      [lat, lon] degrees (EPSG:4326). OSM / Overture data arrive in this frame.
gcj02      Amap "Mars" coordinates. The legacy anchors in assets/walk/campus.json use it.
merc       Web Mercator metres (EPSG:3857). The Esri imagery in assets/cinematic/aligned is in it.
img        Pixel (u, v) of a north-up Mercator image layer (manifest bounds + size).
twin       Campus-aligned local metres, right-handed, Z up:
             +x = campus east  (along Teaching Block 1's long side)
             +y = campus north (along the main axis, towards the North Gate)
           Origin and rotation come from twin/data/frame.json.
gltf       Y-up export frame: gltf = (x, z, -y) of twin.  -Z points to the North Gate,
           the same convention as assets/walk/world.js.

All distances in 'twin' are true ground metres (Mercator scale removed).
"""
from __future__ import annotations
import json, math
from dataclasses import dataclass
from pathlib import Path
from . import TWIN, REPO

R = 6378137.0


def wgs_to_merc(lat: float, lon: float) -> tuple[float, float]:
    return R * math.radians(lon), R * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))


def merc_to_wgs(x: float, y: float) -> tuple[float, float]:
    return math.degrees(2 * math.atan(math.exp(y / R)) - math.pi / 2), math.degrees(x / R)


# --- GCJ-02 (published forward formula; inverse by fixed-point iteration) ---------------
_A, _EE = 6378245.0, 0.00669342162296594323


def _tlat(x, y):
    r = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * math.sqrt(abs(x))
    r += (20 * math.sin(6 * x * math.pi) + 20 * math.sin(2 * x * math.pi)) * 2 / 3
    r += (20 * math.sin(y * math.pi) + 40 * math.sin(y / 3 * math.pi)) * 2 / 3
    r += (160 * math.sin(y / 12 * math.pi) + 320 * math.sin(y * math.pi / 30)) * 2 / 3
    return r


def _tlon(x, y):
    r = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * math.sqrt(abs(x))
    r += (20 * math.sin(6 * x * math.pi) + 20 * math.sin(2 * x * math.pi)) * 2 / 3
    r += (20 * math.sin(x * math.pi) + 40 * math.sin(x / 3 * math.pi)) * 2 / 3
    r += (150 * math.sin(x / 12 * math.pi) + 300 * math.sin(x / 30 * math.pi)) * 2 / 3
    return r


def wgs_to_gcj(lat: float, lon: float) -> tuple[float, float]:
    x, y = lon - 105, lat - 35
    dlat, dlon = _tlat(x, y), _tlon(x, y)
    rad = math.radians(lat)
    magic = 1 - _EE * math.sin(rad) ** 2
    sq = math.sqrt(magic)
    dlat = dlat * 180 / ((_A * (1 - _EE)) / (magic * sq) * math.pi)
    dlon = dlon * 180 / (_A / sq * math.cos(rad) * math.pi)
    return lat + dlat, lon + dlon


def gcj_to_wgs(lat: float, lon: float) -> tuple[float, float]:
    w = [lat, lon]
    for _ in range(40):
        g = wgs_to_gcj(*w)
        d = (lat - g[0], lon - g[1])
        w = [w[0] + d[0], w[1] + d[1]]
        if abs(d[0]) < 1e-11 and abs(d[1]) < 1e-11:
            break
    return w[0], w[1]


# --- imagery layers -------------------------------------------------------------------
@dataclass
class ImageLayer:
    name: str
    path: Path
    bounds: tuple[float, float, float, float]   # merc x0, y0, x1, y1
    pixels: int

    @classmethod
    def load(cls, name: str = 'courtyard') -> 'ImageLayer':
        man = json.loads((REPO / 'assets/cinematic/aligned/manifest.json').read_text())
        lay = next(l for l in man['layers'] if l['name'] == name)
        return cls(name, REPO / lay['path'], tuple(lay['bounds']), lay['pixels'])

    @property
    def merc_per_px(self) -> float:
        return (self.bounds[2] - self.bounds[0]) / self.pixels

    def px_to_merc(self, u: float, v: float) -> tuple[float, float]:
        x0, y0, x1, y1 = self.bounds
        return x0 + u / self.pixels * (x1 - x0), y1 - v / self.pixels * (y1 - y0)

    def merc_to_px(self, x: float, y: float) -> tuple[float, float]:
        x0, y0, x1, y1 = self.bounds
        return (x - x0) / (x1 - x0) * self.pixels, (y1 - y) / (y1 - y0) * self.pixels

    def px_to_wgs(self, u, v):
        return merc_to_wgs(*self.px_to_merc(u, v))

    def wgs_to_px(self, lat, lon):
        return self.merc_to_px(*wgs_to_merc(lat, lon))


# --- the twin frame ---------------------------------------------------------------------
@dataclass
class TwinFrame:
    """Campus-aligned local frame.

    origin_wgs: WGS84 of the frame origin (ground level).
    theta_deg:  anticlockwise rotation of campus north from true north (campus north bearing = 360 - theta).
    """
    origin_wgs: tuple[float, float]
    theta_deg: float

    @classmethod
    def load(cls, path: Path | None = None) -> 'TwinFrame':
        d = json.loads((path or TWIN / 'data/frame.json').read_text())
        return cls(tuple(d['origin']['wgs84']), d['rotation']['theta_deg'])

    # local tangent plane at the origin: Mercator metres scaled by cos(lat0) are ground metres
    @property
    def _k(self):
        return math.cos(math.radians(self.origin_wgs[0]))

    @property
    def _om(self):
        return wgs_to_merc(*self.origin_wgs)

    def en_to_twin(self, e: float, n: float) -> tuple[float, float]:
        t = math.radians(self.theta_deg)
        # campus east unit vector in (e, n): bearing 90 - theta -> (cos t, sin t)
        x = e * math.cos(t) + n * math.sin(t)
        y = -e * math.sin(t) + n * math.cos(t)
        return x, y

    def twin_to_en(self, x: float, y: float) -> tuple[float, float]:
        t = math.radians(self.theta_deg)
        return x * math.cos(t) - y * math.sin(t), x * math.sin(t) + y * math.cos(t)

    def merc_to_twin(self, mx, my):
        ox, oy = self._om
        return self.en_to_twin((mx - ox) * self._k, (my - oy) * self._k)

    def twin_to_merc(self, x, y):
        e, n = self.twin_to_en(x, y)
        ox, oy = self._om
        return ox + e / self._k, oy + n / self._k

    def wgs_to_twin(self, lat, lon):
        return self.merc_to_twin(*wgs_to_merc(lat, lon))

    def twin_to_wgs(self, x, y):
        return merc_to_wgs(*self.twin_to_merc(x, y))


def gltf_from_twin(x, y, z):
    return x, z, -y


def bearing_deg(e: float, n: float) -> float:
    return (math.degrees(math.atan2(e, n)) + 360) % 360
