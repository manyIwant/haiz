#!/usr/bin/env python3
"""
HAIZ World Reconstruction — Canonical Campus Specification Compiler.

Reads authoritative public-map geometry (Overture/OSM via twin/data/campus.json)
and photo-calibrated landmark records (twin/data/*.json), reconciles building
identities against aerial/ground campus photography, eliminates legacy spatial
overlaps, and emits a single canonical source of truth:
    world-reconstruction/data/world_spec.json

Coordinate Convention (HAIZ-ENU-2026):
  - Blender / Spec space: metric right-handed, origin (0, 0, 0) at Teaching Block 1
    front portal centre on the main axis at forecourt road datum (z = 0.0 m).
    +X = campus east, +Y = campus north (toward North Gate), +Z = up.
  - Three.js / glTF space: (x, y, z)_three = (x, z, -y)_spec, so -Z points to North Gate.
  - WGS84 Anchor: 19.99847892 N, 110.34254843 E; Campus North bearing 319.0 deg
    (41.0 deg CCW from true north, provisional per twin/data/frame.json).
"""
from __future__ import annotations

import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TWIN = ROOT / "twin" / "data"
OUT = ROOT /  "world-reconstruction-r2" / "data" / "world_spec.json"


def poly_area(pts: list[list[float]]) -> float:
    n = len(pts)
    if n < 3:
        return 0.0
    s = 0.0
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        s += x1 * y2 - x2 * y1
    return 0.5 * s


def ensure_ccw(pts: list[list[float]]) -> list[list[float]]:
    clean = []
    for p in pts:
        if not clean or math.hypot(p[0] - clean[-1][0], p[1] - clean[-1][1]) > 0.05:
            clean.append([round(float(p[0]), 3), round(float(p[1]), 3)])
    if len(clean) > 2 and math.hypot(clean[0][0] - clean[-1][0], clean[0][1] - clean[-1][1]) < 0.05:
        clean.pop()
    if poly_area(clean) < 0:
        clean.reverse()
    return clean


def poly_stats(pts: list[list[float]]):
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    cx = sum(xs) / len(xs)
    cy = sum(ys) / len(ys)
    return {
        "center": [round(cx, 2), round(cy, 2)],
        "bbox": [round(min(xs), 2), round(min(ys), 2), round(max(xs), 2), round(max(ys), 2)],
        "size": [round(max(xs) - min(xs), 2), round(max(ys) - min(ys), 2)],
        "area": round(abs(poly_area(pts)), 1),
    }


def rect_poly(x0: float, y0: float, x1: float, y1: float) -> list[list[float]]:
    return [[round(x0, 2), round(y0, 2)], [round(x1, 2), round(y0, 2)],
            [round(x1, 2), round(y1, 2)], [round(x0, 2), round(y1, 2)]]


def main():
    twin_campus = json.loads((TWIN / "campus.json").read_text())
    twin_frame = json.loads((TWIN / "frame.json").read_text())
    twin_gate = json.loads((TWIN / "gate.json").read_text())
    twin_site = json.loads((TWIN / "site.json").read_text())
    twin_yihao = json.loads((TWIN / "buildings" / "yihao.json").read_text())
    twin_trees = json.loads((TWIN / "trees.json").read_text())
    twin_yanchi = json.loads((TWIN / "yanchi.json").read_text())

    # ------------------------------------------------------------------
    # Curated mapping of OSM record IDs / footprints to real campus buildings
    # Verified against aerial_campus.jpg, Esri orthophoto, and campus_*.jpg
    # ------------------------------------------------------------------
    OSM_CATALOG = {
        "w1165596682@1": {
            "id": "yihao",
            "name": "一号教学楼",
            "en": "Teaching Block 1 (1923)",
            "district": "d01_axis_forecourt",
            "archetype": "hero_yihao",
            "floors": 6,
            "height": 22.8,
            "roof_style": "terracotta_lingnan_hip",
            "tag": "photo-derived/public-map",
            "basis": "OSM way 1165596682 + hero-2560/jiaoxuelou-1600/scenery_13/aerial_campus calibration (twin/data/buildings/yihao.json)",
            "story": "府城校区中轴主楼，花岗岩双层柱廊与双楼梯塔楼拱卫「1923」阶梯门厅，琉璃红瓦翘檐承接百年海中文脉。",
        },
        "w1165596684@1": {
            "id": "link_w12",
            "name": "一二号楼西连廊",
            "en": "West Skybridge (1-2)",
            "district": "d02_academic_core",
            "archetype": "skybridge",
            "floors": 5,
            "height": 17.5,
            "roof_style": "flat_parapet",
            "tag": "public-map/estimated",
            "basis": "OSM way 1165596684 + aerial_campus; links Block 1 rear to Block 2 north facade",
            "story": "连通一号楼与二号楼的架空敞廊，遮挡热带烈日与突如其来的海口阵雨。",
        },
        "w1165596685@1": {
            "id": "link_e12",
            "name": "一二号楼东连廊",
            "en": "East Skybridge (1-2)",
            "district": "d02_academic_core",
            "archetype": "skybridge",
            "floors": 5,
            "height": 17.5,
            "roof_style": "flat_parapet",
            "tag": "public-map/estimated",
            "basis": "OSM way 1165596685 + aerial_campus; links Block 1 rear to Block 2 north facade",
            "story": "与西连廊对称围合起清荫内院，课间穿行其间可望见院心绿树与晴光。",
        },
        "w1165596683@1": {
            "id": "erhao",
            "name": "二号教学楼",
            "en": "Teaching Block 2",
            "district": "d02_academic_core",
            "archetype": "tropical_academic_gallery",
            "floors": 5,
            "height": 17.8,
            "roof_style": "flat_parapet",
            "wall_palette": "ivory_stucco",
            "tag": "photo-derived/public-map",
            "basis": "OSM way 1165596683 + campus_erhao.jpg (5 storeys, open courtyard gallery, classroom grilles, AC units)",
            "story": "五层通透外廊教学楼，与一号楼围合静谧内院，白墙挑廊映出细长的热带晴影。",
        },
        "w1165596686@1": {
            "id": "link_sci2",
            "name": "科二连廊",
            "en": "Science-Block 2 Walkway",
            "district": "d02_academic_core",
            "archetype": "covered_walk",
            "floors": 2,
            "height": 7.2,
            "roof_style": "flat_parapet",
            "tag": "public-map/estimated",
            "basis": "OSM way 1165596686 (cleanly trimmed at facade faces; eliminates legacy 26% overlap bug)",
            "story": "连接二号教学楼与科学馆的阴凉连廊，实验课往返必经之路。",
        },
        "w1165596687@1": {
            "id": "science",
            "name": "科学馆实验大楼",
            "en": "Science Laboratory Hall",
            "district": "d02_academic_core",
            "archetype": "science_hall",
            "floors": 6,
            "height": 21.8,
            "roof_style": "flat_parapet_crown",
            "wall_palette": "ivory_stucco",
            "tag": "photo-derived/public-map",
            "basis": "OSM way 1165596687 + campus_kexue.jpg (6 storeys, horizontal white galleries, dark sun screens, raised stair cap)",
            "story": "一百二十米长的六层实验建筑群，通长遮阳外廊与暗色格栅构成克制的现代校园立面。",
        },
        "w1165596688@1": {
            "id": "south_classrooms",
            "name": "南侧教学楼群（三四号楼 / 科技活动中心）",
            "en": "South Classrooms & Science Activity Center",
            "district": "d02_academic_core",
            "archetype": "coral_courtyard_academic",
            "floors": 5,
            "height": 18.2,
            "roof_style": "flat_parapet",
            "wall_palette": "coral_terracotta",
            "tag": "photo-derived/public-map",
            "basis": "OSM way 1165596688 + campus_sanhao_sihao.jpg (warm dusty-coral walls, twin planted courts, open breezeway bridges)",
            "story": "围合两座热带棕榈庭院的陶粉色教学楼群，层间敞开连桥引入穿堂海风。",
        },
        "w1165596679@2": {
            "id": "fengqitang",
            "name": "凤栖堂",
            "en": "Fengqitang Heritage Hall",
            "district": "d04_heritage_gardens",
            "archetype": "lingnan_green_hall",
            "floors": 1,
            "height": 7.6,
            "roof_style": "emerald_lingnan_hip",
            "tag": "photo-derived/public-map",
            "basis": "OSM way 1165596679 + campus_fengqitang.jpg (single-storey hall, emerald glazed hip roof, vermilion columns, white walls, bronze statue)",
            "story": "孔雀绿琉璃瓦歇山屋顶与朱红廊柱掩映在鸡蛋花树影间，承载百年海中的传统书院气韵。",
        },
        "w1165596678@2": {
            "id": "yanlintang",
            "name": "衍林堂",
            "en": "Yanlintang Memorial Hall",
            "district": "d04_heritage_gardens",
            "archetype": "lingnan_green_hall",
            "floors": 1,
            "height": 7.6,
            "roof_style": "emerald_lingnan_hip",
            "tag": "public-map/estimated",
            "basis": "OSM way 1165596678 + school history (honoring first principal Zhong Yanlin; single-storey emerald-roofed hall)",
            "story": "纪念首任校长钟衍林先生的传统堂馆，绿瓦红柱与前庭「春风化雨」意象遥相呼应。",
        },
        "w1165596671@2": {
            "id": "gymnasium",
            "name": "体育馆",
            "en": "Campus Gymnasium",
            "district": "d05_sports_living",
            "archetype": "modern_gymnasium",
            "floors": 3,
            "height": 14.5,
            "roof_style": "vaulted_metal",
            "tag": "public-map/estimated",
            "basis": "OSM way 1165596671 (2,763 m2 real footprint south of track; previously missing in legacy campus.json; facade estimated)",
            "story": "紧邻运动场南侧的大跨度室内体育馆，弧形采光屋顶与遮阳廊道回应热带运动空间。",
        },
        "w1444498479@1": {
            "id": "dorm_f",
            "name": "女生宿舍",
            "en": "Girls' Courtyard Dormitory",
            "district": "d05_sports_living",
            "archetype": "red_roof_dorm_courtyard",
            "floors": 6,
            "height": 21.0,
            "roof_style": "terracotta_lingnan_hip",
            "wall_palette": "white_coral_plinth",
            "tag": "photo-derived/public-map",
            "basis": "OSM way 1444498479 + campus_dorm_f.jpg + aerial_campus.jpg (6 storeys, coral lower plinth, white recessed balconies, terracotta hip roof)",
            "story": "红瓦合院式女生宿舍，淡陶粉基座与白色通廊阳台环抱绿荫球场。",
        },
        "w1444498442@1": {
            "id": "dorm_m_north",
            "name": "男生宿舍（东区北栋）",
            "en": "Boys' Dormitory North",
            "district": "d05_sports_living",
            "archetype": "tropical_dorm_slab",
            "floors": 7,
            "height": 22.8,
            "roof_style": "flat_parapet",
            "wall_palette": "pale_ceramic_tile",
            "tag": "photo-derived/public-map",
            "basis": "OSM way 1444498442 + campus_dorm_m.jpg (7-storey pale tiled dormitory slab with recessed loggia windows)",
            "story": "东侧林荫道旁的七层男生宿舍，浅米瓷砖与深凹阳台框出热带日照下的冷暖明暗。",
        },
        "w1444498445@1": {
            "id": "dorm_m_east1",
            "name": "男生宿舍（东区中栋）",
            "en": "Boys' Dormitory Central",
            "district": "d05_sports_living",
            "archetype": "tropical_dorm_slab",
            "floors": 6,
            "height": 19.6,
            "roof_style": "flat_parapet",
            "wall_palette": "pale_ceramic_tile",
            "tag": "public-map/estimated",
            "basis": "OSM way 1444498445 + campus_dorm_m.jpg typology",
            "story": "东生活区寄宿宿舍楼，傍晚自习前后灯火与蝉鸣交织。",
        },
        "w1444498446@1": {
            "id": "dorm_m_mid1",
            "name": "东区宿舍（中北）",
            "en": "East Residence Wing A",
            "district": "d05_sports_living",
            "archetype": "tropical_dorm_slab",
            "floors": 6,
            "height": 19.6,
            "roof_style": "flat_parapet",
            "wall_palette": "pale_ceramic_tile",
            "tag": "public-map/estimated",
            "basis": "OSM way 1444498446; height & facade estimated from campus_dorm_m.jpg",
            "story": "东侧教学与生活过渡区的宿舍建筑。",
        },
        "w1444498447@1": {
            "id": "dorm_m_mid2",
            "name": "东区宿舍（中南）",
            "en": "East Residence Wing B",
            "district": "d05_sports_living",
            "archetype": "tropical_dorm_slab",
            "floors": 6,
            "height": 19.6,
            "roof_style": "flat_parapet",
            "wall_palette": "pale_ceramic_tile",
            "tag": "public-map/estimated",
            "basis": "OSM way 1444498447; height & facade estimated from campus_dorm_m.jpg",
            "story": "面向校园东侧绿带的多层宿舍楼。",
        },
        "w1444498444@1": {
            "id": "canteen1",
            "name": "第一食堂",
            "en": "First Canteen",
            "district": "d05_sports_living",
            "archetype": "campus_canteen",
            "floors": 3,
            "height": 12.2,
            "roof_style": "flat_parapet",
            "wall_palette": "warm_cream_tile",
            "tag": "public-map/estimated",
            "basis": "OSM way 1444498444 + campus_canteen1.jpg (3 storeys, broad shaded ground colonnade, dining halls)",
            "story": "校园东侧人气最旺的食堂，宽敞底层柱廊与窗前总是聚满刚下课的同学和蹲点的橘猫。",
        },
        "w1444498443@1": {
            "id": "east_hall_se",
            "name": "东南生活楼",
            "en": "Southeast Living Annex",
            "district": "d05_sports_living",
            "archetype": "tropical_dorm_slab",
            "floors": 5,
            "height": 16.5,
            "roof_style": "flat_parapet",
            "wall_palette": "warm_cream_tile",
            "tag": "public-map/estimated",
            "basis": "OSM way 1444498443; height estimated",
            "story": "东南区生活配套建筑。",
        },
        "w1444498448@1": {
            "id": "dorm_se_a",
            "name": "南区宿舍（北）",
            "en": "South Dormitory North",
            "district": "d05_sports_living",
            "archetype": "tropical_dorm_slab",
            "floors": 6,
            "height": 19.6,
            "roof_style": "flat_parapet",
            "wall_palette": "pale_ceramic_tile",
            "tag": "public-map/estimated",
            "basis": "OSM way 1444498448; height estimated",
            "story": "砚池东南侧的安静宿舍区。",
        },
        "w1444498449@1": {
            "id": "dorm_se_b",
            "name": "南区宿舍（南）",
            "en": "South Dormitory South",
            "district": "d05_sports_living",
            "archetype": "tropical_dorm_slab",
            "floors": 6,
            "height": 19.6,
            "roof_style": "flat_parapet",
            "wall_palette": "pale_ceramic_tile",
            "tag": "public-map/estimated",
            "basis": "OSM way 1444498449; height estimated",
            "story": "临近南侧院墙的六层学生宿舍。",
        },
        "w1444498450@1": {
            "id": "south_annex_e",
            "name": "南区综合楼（东）",
            "en": "South Complex East",
            "district": "d05_sports_living",
            "archetype": "tropical_academic_gallery",
            "floors": 5,
            "height": 17.2,
            "roof_style": "flat_parapet",
            "wall_palette": "ivory_stucco",
            "tag": "public-map/estimated",
            "basis": "OSM way 1444498450; height estimated",
            "story": "位于艺术中心南侧的校园建筑。",
        },
        "w1444498451@1": {
            "id": "south_annex_w",
            "name": "南区综合楼（西）",
            "en": "South Complex West",
            "district": "d05_sports_living",
            "archetype": "tropical_academic_gallery",
            "floors": 5,
            "height": 17.2,
            "roof_style": "flat_parapet",
            "wall_palette": "ivory_stucco",
            "tag": "public-map/estimated",
            "basis": "OSM way 1444498451; height estimated",
            "story": "通往南门主干道东侧的多层楼宇。",
        },
        "w1444498480@1": {
            "id": "canteen3",
            "name": "第三食堂与生活中心",
            "en": "Third Canteen & Student Center",
            "district": "d05_sports_living",
            "archetype": "campus_canteen",
            "floors": 3,
            "height": 12.2,
            "roof_style": "flat_parapet",
            "wall_palette": "warm_cream_tile",
            "tag": "public-map/estimated",
            "basis": "OSM way 1444498480 + campus_canteen3.jpg; southwest dining & living complex near South Gate",
            "story": "西南区食堂与生活楼，紧邻植物园绿荫与南门通道。",
        },
    }

    buildings = []
    used_osm_ids = set()

    # 1. Process known OSM footprints inside the school
    for idx, b in enumerate(twin_campus["buildings"]):
        if not b.get("in_school"):
            continue
        rec = b.get("record")
        pts = ensure_ccw(b["poly"])
        st = poly_stats(pts)
        cx, cy = st["center"]
        area = st["area"]

        if rec in OSM_CATALOG:
            meta = dict(OSM_CATALOG[rec])
            meta["osm_record"] = rec
            meta["poly"] = pts
            meta.update(st)
            buildings.append(meta)
            used_osm_ids.add(rec)
            continue

        # Filter out known noisy / tiny Zenodo machine-traced blobs on courts or < 120 m2
        if area < 160:
            continue
        # Detect Zenodo footprints overlapping the basketball court area (x -128..-72, y -68..10)
        if -128 < cx < -72 and -68 < cy < 10 and rec is None:
            continue
        # Detect Art Center Zenodo polygons (x -20..58, y -190..-128): handled cleanly by dedicated hero_arts!
        if -22 < cx < 60 and -190 < cy < -126 and rec is None:
            continue
        # Detect Library Zenodo polygons around (75..125, -18..35): handled by dedicated hero_library!
        if 72 < cx < 125 and -22 < cy < 36 and rec is None:
            continue

        # Identify remaining substantial real school footprints cleanly
        if -155 < cx < -100 and 15 < cy < 55 and area > 500:
            # Grandstand / bleachers along south edge of track!
            buildings.append({
                "id": "stadium_stand",
                "name": "运动场看台",
                "en": "Track Grandstand",
                "district": "d05_sports_living",
                "archetype": "stadium_grandstand",
                "floors": 2,
                "height": 8.5,
                "roof_style": "cantilever_canopy",
                "poly": pts,
                **st,
                "tag": "public-map/estimated",
                "basis": "Overture/Zenodo footprint bordering the south edge of 运动场 track; stepped seating canopy estimated",
                "story": "俯瞰四百米红褐塑胶跑道的露天看台，校运会与黄昏散步的绝佳观景台。",
            })
        elif -115 < cx < -70 and 10 < cy < 35 and area > 350:
            buildings.append({
                "id": "west_sports_annex",
                "name": "体艺附楼",
                "en": "West Sports Annex",
                "district": "d05_sports_living",
                "archetype": "tropical_academic_gallery",
                "floors": 3,
                "height": 11.4,
                "roof_style": "flat_parapet",
                "wall_palette": "ivory_stucco",
                "poly": pts,
                **st,
                "tag": "public-map/estimated",
                "basis": "Overture/Zenodo footprint between Fengqitang and Sports Courts; height estimated",
                "story": "位于球场与凤栖堂之间的低层校园附楼。",
            })
        else:
            buildings.append({
                "id": f"campus_wing_{idx:02d}",
                "name": "校园附楼",
                "en": f"Campus Wing {idx:02d}",
                "district": "d05_sports_living",
                "archetype": "tropical_dorm_slab",
                "floors": 4,
                "height": 14.0,
                "roof_style": "flat_parapet",
                "wall_palette": "warm_cream_tile",
                "poly": pts,
                **st,
                "tag": "public-map/invented",
                "basis": "Overture/Zenodo footprint inside school polygon; storeys and facade style estimated",
                "story": "府城校区内辅助教学与后勤建筑。",
            })

    # ------------------------------------------------------------------
    # 2. Dedicated Hero & Landmark Buildings (photo-grounded where OSM lacks full polygon)
    # ------------------------------------------------------------------
    # Art Education Center (directly south-west of Yanchi, ZERO overlap with Yanchi y=[-130..-108], x=[37..64])
    arts_poly = rect_poly(-14.0, -184.0, 44.0, -131.5)
    buildings.append({
        "id": "arts",
        "name": "艺术教育活动中心",
        "en": "Art Education Center",
        "district": "d03_yanchi_arts",
        "archetype": "hero_arts",
        "floors": 3,
        "height": 13.8,
        "roof_style": "terracotta_lingnan_hip",
        "poly": arts_poly,
        **poly_stats(arts_poly),
        "tag": "photo-derived/public-map",
        "basis": "Esri orthophoto + Overture footprint + campus_yishu.jpg (red hipped entrance portico with white piers facing Yanchi, stepped entry stairs, red-tiled courtyard wings; strictly clear of Yanchi polygon)",
        "story": "面朝砚池水面的红瓦合院艺术中心，白柱门廊拾级而上，琴声与画意常在池畔回荡。",
    })

    # Library & Astronomical Observatory (visible in aerial_campus.jpg east of Teaching Block 1 + campus_library.jpg)
    lib_poly = rect_poly(78.0, -16.0, 118.0, 26.0)
    buildings.append({
        "id": "library",
        "name": "图书馆与天文台",
        "en": "Library & Astronomical Observatory",
        "district": "d04_heritage_gardens",
        "archetype": "hero_library",
        "floors": 4,
        "height": 17.2,
        "roof_style": "observatory_dome",
        "poly": lib_poly,
        **poly_stats(lib_poly),
        "tag": "photo-derived/estimated",
        "basis": "campus_library.jpg + aerial_campus.jpg (4-storey white modernist massing, sweeping external grand staircase, arched blue-green glass atrium, ribbed metallic astronomical observatory dome; footprint placed east of Block 1 matching aerial)",
        "story": "白色现代主义图书馆，室外大台阶直通阅览大厅，拱形蓝绿玻璃幕墙之上矗立着海口中学少见的银色天文台穹顶。",
    })

    # Science & Technology Building (campus_keji.jpg — NE precinct near North Gate, clear of Yanlintang)
    keji_poly = rect_poly(18.0, 78.0, 58.0, 97.0)
    buildings.append({
        "id": "keji",
        "name": "科技楼",
        "en": "Science & Technology Building",
        "district": "d02_academic_core",
        "archetype": "hero_keji",
        "floors": 5,
        "height": 18.8,
        "roof_style": "flat_parapet",
        "poly": keji_poly,
        **poly_stats(keji_poly),
        "tag": "photo-derived/estimated",
        "basis": "campus_keji.jpg (crisp white and warm-sand vertical facade fins, double-height recessed bronze-framed glass lobby; footprint placed NE of forecourt per legacy/campus plan)",
        "story": "白与暖沙竖向遮阳肋板交织的现代科技楼，双层挑高玻璃大堂映出前庭草坪与树影。",
    })

    # Alumni Association Hall (campus_xiaoyouhui.jpg — 2-storey emerald-roofed traditional house east of axis)
    alumni_poly = rect_poly(82.0, 42.0, 102.0, 56.0)
    buildings.append({
        "id": "xiaoyouhui",
        "name": "校友会馆",
        "en": "Alumni Association Hall",
        "district": "d04_heritage_gardens",
        "archetype": "hero_alumni",
        "floors": 2,
        "height": 10.2,
        "roof_style": "emerald_lingnan_gable",
        "poly": alumni_poly,
        **poly_stats(alumni_poly),
        "tag": "photo-derived/estimated",
        "basis": "campus_xiaoyouhui.jpg (two-storey whitewashed hall, double-tiered emerald glazed eaves, vermilion carved lattice windows and balcony rail; position estimated near Yanlintang)",
        "story": "重檐孔雀绿瓦与朱红花窗构成的二层校友会馆，百年历届海中学子重返府城的家园。",
    })

    # North Gate (photo-calibrated twin/data/gate.json)
    ng_poly = rect_poly(-8.8, 104.8, 8.8, 107.6)
    buildings.append({
        "id": "beimen",
        "name": "北门牌坊（海南中學）",
        "en": "North Gate Paifang",
        "district": "d01_axis_forecourt",
        "archetype": "hero_north_gate",
        "floors": 1,
        "height": 9.4,
        "roof_style": "emerald_paifang",
        "poly": ng_poly,
        **poly_stats(ng_poly),
        "tag": "photo-derived",
        "basis": "hero-2560.jpg calibrated gate plane (6.78 mm/px, twin/data/gate.json): triple-bay white paifang, emerald glazed curved roofs, golden fretwork, four stone lions, 「海南中學」 plaque",
        "story": "府城校区标志性三间四柱琉璃绿瓦牌坊，金字「海南中學」面向大路街，四尊石狮静守百年校门。",
    })

    # South Gate (campus_nanmen.jpg — emerald paifang at south boundary)
    sg_poly = rect_poly(-75.0, -258.5, -57.0, -255.5)
    buildings.append({
        "id": "nanmen",
        "name": "南门牌坊",
        "en": "South Gate Paifang",
        "district": "d05_sports_living",
        "archetype": "hero_south_gate",
        "floors": 1,
        "height": 8.4,
        "roof_style": "emerald_paifang",
        "poly": sg_poly,
        **poly_stats(sg_poly),
        "tag": "photo-derived/estimated",
        "basis": "campus_nanmen.jpg (emerald glazed tile triple-bay paifang facing Gaodeng West Street; dimensions estimated from photo)",
        "story": "连接高登西街烟火市井的南校门，放学时分满是穿青白校服的海中少年与骑行车流。",
    })

    # Pavilions: Fengqiting & Yanlinting (campus_yanlintang.jpg — square emerald-roofed open pavilions)
    for pid, pname, pen, px, py in [
        ("fengqiting", "凤栖亭", "Fengqiting Pavilion", -40.0, 56.0),
        ("yanlinting", "衍林亭", "Yanlinting Pavilion", 34.0, 55.0),
    ]:
        pp = rect_poly(px - 3.2, py - 3.2, px + 3.2, py + 3.2)
        buildings.append({
            "id": pid,
            "name": pname,
            "en": pen,
            "district": "d04_heritage_gardens",
            "archetype": "hero_pavilion",
            "floors": 1,
            "height": 5.8,
            "roof_style": "emerald_pavilion",
            "poly": pp,
            **poly_stats(pp),
            "tag": "photo-derived/estimated",
            "basis": "campus_yanlintang.jpg (square open pavilion, emerald glazed pyramidal curved roof, red columns on stone drum bases, wrap-around bench rail; position estimated in north garden lawns)",
            "story": "四角攒尖孔雀绿瓦凉亭，朱红木柱配美人靠长凳，是课间纳凉与雨天听雨的好去处。",
        })

    # ------------------------------------------------------------------
    # 3. Context Buildings outside school boundary (150 real OSM footprints)
    # ------------------------------------------------------------------
    context_buildings = []
    for idx, b in enumerate(twin_campus["buildings"]):
        if b.get("in_school"):
            continue
        pts = ensure_ccw(b["poly"])
        st = poly_stats(pts)
        if st["area"] < 25:
            continue
        # Deterministic realistic Fucheng urban heights (4-14 storeys)
        h_seed = abs(int(st["center"][0] * 13 + st["center"][1] * 29)) % 100
        if st["area"] > 900:
            floors = 6 + (h_seed % 7)
        elif st["area"] > 300:
            floors = 5 + (h_seed % 5)
        else:
            floors = 3 + (h_seed % 4)
        context_buildings.append({
            "id": f"fucheng_ctx_{idx:03d}",
            "poly": pts,
            "center": st["center"],
            "floors": floors,
            "height": round(floors * 3.15 + 0.8, 1),
            "palette": h_seed % 5,
            "tag": "public-map/invented",
        })

    # ------------------------------------------------------------------
    # 4. Sports Courts, Track, Water, Roads & Plazas (unified metric frame)
    # ------------------------------------------------------------------
    sports_features = []
    for i, l in enumerate(twin_campus.get("land_use", [])):
        pts = ensure_ccw(l["poly"])
        st = poly_stats(pts)
        cls = l.get("class")
        nm = l.get("name")
        cx, cy = st["center"]
        if cls == "track" or nm == "运动场":
            kind = "stadium_track" if cls == "track" else "stadium_bounds"
        elif cls == "pitch" and cx < -125 and cy > 40:
            kind = "football_pitch"
        elif cls == "pitch" and -130 < cx < -70 and -68 < cy < 10:
            kind = "basketball_court"
        elif cls == "plaza":
            kind = "plaza"
        else:
            kind = "recreation"
        sports_features.append({
            "id": f"lu_{i:02d}",
            "kind": kind,
            "name": nm or kind,
            "poly": pts,
            **st,
            "tag": "public-map",
        })

    # Add 3 volleyball courts just west/north of basketball courts (observed on aerial_campus.jpg)
    for vi in range(3):
        vx0 = -126.0 + vi * 17.5
        vp = rect_poly(vx0, 8.0, vx0 + 15.0, 26.5)
        sports_features.append({
            "id": f"volleyball_{vi}",
            "kind": "volleyball_court",
            "name": f"排球场 {vi+1}",
            "poly": vp,
            **poly_stats(vp),
            "tag": "photo-derived/estimated",
        })

    yanchi_poly = ensure_ccw(twin_campus["water"][0]["poly"])
    school_boundary = ensure_ccw(twin_campus["school"]["poly"])

    # Clean, fully connected road network in HAIZ-ENU-2026 (fixes all legacy disconnected canteen/library/south-gate warnings!)
    roads = [
        {"id": "axis_avenue", "name": "北门中轴椰林大道", "width": 12.0, "pts": [[0.0, 122.0], [0.0, 46.0]], "surface": "asphalt", "tag": "public-map/photo-derived"},
        {"id": "forecourt_east_west", "name": "前庭东西校道", "width": 7.8, "pts": [[-145.0, 46.4], [132.0, 46.4]], "surface": "asphalt", "tag": "public-map"},
        {"id": "east_spine", "name": "东区林荫主道", "width": 6.8, "pts": [[68.0, 74.0], [68.0, -236.0]], "surface": "asphalt", "tag": "estimated"},
        {"id": "east_dorm_lane", "name": "东宿舍与一堂校道", "width": 6.2, "pts": [[128.0, 46.4], [128.0, -210.0]], "surface": "asphalt", "tag": "estimated"},
        {"id": "west_spine", "name": "西区运动场与宿舍主道", "width": 7.2, "pts": [[-68.0, 82.0], [-68.0, -264.0]], "surface": "asphalt", "tag": "estimated"},
        {"id": "west_outer_lane", "name": "体育馆与三堂西道", "width": 6.0, "pts": [[-132.0, 46.4], [-132.0, -230.0]], "surface": "asphalt", "tag": "estimated"},
        {"id": "mid_court_cross", "name": "二号楼南横道", "width": 5.8, "pts": [[-132.0, -64.0], [128.0, -64.0]], "surface": "stone", "tag": "estimated"},
        {"id": "yanchi_cross", "name": "科学馆与砚池横道", "width": 6.4, "pts": [[-132.0, -104.0], [128.0, -104.0]], "surface": "stone", "tag": "estimated"},
        {"id": "south_cross", "name": "艺术中心与南区横道", "width": 6.4, "pts": [[-132.0, -196.0], [128.0, -196.0]], "surface": "asphalt", "tag": "estimated"},
        {"id": "north_street", "name": "大路街（校外北街）", "width": 12.0, "pts": [[-160.0, 148.0], [0.0, 128.0], [160.0, 96.0]], "surface": "asphalt", "tag": "public-map"},
        {"id": "south_street", "name": "高登西街（校外南街）", "width": 11.0, "pts": [[-180.0, -268.0], [120.0, -268.0]], "surface": "asphalt", "tag": "estimated"},
    ]

    # Key landmark anchors & curated camera viewpoints (in spec coords: x east, y north, z up)
    vistas = [
        {
            "id": "axis_arrival",
            "name": "中轴初遇 · 一号楼与太湖石",
            "subtitle": "太阳斜照在「1923」红瓦门厅、太湖石与百年榄仁树冠之间",
            "pos": [-8.5, 52.0, 4.2],
            "target": [6.0, 8.0, 7.5],
            "district": "d01_axis_forecourt",
        },
        {
            "id": "north_gate",
            "name": "北门入画 · 海南中學牌坊",
            "subtitle": "大路街南望孔雀绿琉璃牌坊与大王椰子中轴大道",
            "pos": [0.0, 124.0, 2.2],
            "target": [0.0, 45.0, 6.0],
            "district": "d01_axis_forecourt",
        },
        {
            "id": "terminalia",
            "name": "百年榄仁 · 卧枝巨石",
            "subtitle": "东侧花岗岩广场上 S 形低枝轻卧古石的百年榄仁树",
            "pos": [55.5, 31.0, 2.4],
            "target": [38.9, 14.5, 4.5],
            "district": "d01_axis_forecourt",
        },
        {
            "id": "yanchi_arts",
            "name": "砚池叠水 · 艺术中心",
            "subtitle": "朱红「砚池」题石、弧形跌水、椰林与红瓦白柱门廊",
            "pos": [61.0, -104.0, 3.8],
            "target": [36.0, -126.0, 3.2],
            "district": "d03_yanchi_arts",
        },
        {
            "id": "library_dome",
            "name": "图书馆 · 天文台穹顶",
            "subtitle": "室外大台阶、蓝绿弧形幕墙与屋顶银色天文台穹顶",
            "pos": [68.0, 34.0, 5.5],
            "target": [98.0, 4.0, 9.5],
            "district": "d04_heritage_gardens",
        },
        {
            "id": "fengqitang",
            "name": "凤栖古韵 · 绿瓦红柱",
            "subtitle": "凤栖堂与凤栖亭在热带树影中的宁静书院气韵",
            "pos": [-16.0, 52.0, 3.5],
            "target": [-40.4, 76.0, 4.0],
            "district": "d04_heritage_gardens",
        },
        {
            "id": "sports_sunset",
            "name": "运动场 · 椰风落日",
            "subtitle": "四百米红褐跑道、六片篮球场与夕照下的体育馆",
            "pos": [-76.0, 42.0, 11.0],
            "target": [-148.0, 68.0, 2.0],
            "district": "d05_sports_living",
        },
        {
            "id": "aerial_fucheng",
            "name": "府城全景 · 百年校园鸟瞰",
            "subtitle": "从北门上空俯瞰完整府城校区与琼山街区天际线",
            "pos": [52.0, 185.0, 118.0],
            "target": [-8.0, -42.0, 4.0],
            "district": "d01_axis_forecourt",
        },
    ]

    # Microclimate thermal updrafts for Campus Glide mode
    thermals = [
        {"id": "thermal_track", "name": "运动场暖流", "xy": [-148.0, 74.0], "radius": 28.0, "lift": 4.2},
        {"id": "thermal_yihao", "name": "一号楼红瓦热流", "xy": [0.0, -6.0], "radius": 22.0, "lift": 3.4},
        {"id": "thermal_terminalia", "name": "百年榄仁风涡", "xy": [42.0, 18.0], "radius": 18.0, "lift": 3.0},
        {"id": "thermal_yanchi", "name": "砚池水汽升流", "xy": [46.0, -116.0], "radius": 20.0, "lift": 3.2},
        {"id": "thermal_courts", "name": "球场晴风柱", "xy": [-98.0, -30.0], "radius": 22.0, "lift": 3.6},
        {"id": "thermal_library", "name": "天文台海风升流", "xy": [98.0, 4.0], "radius": 20.0, "lift": 3.3},
    ]

    spec = {
        "schema": "haiz-world-reconstruction-spec/1",
        "project": "HAIZ · World Reconstruction (海南中学府城校区数字世界重构)",
        "frame": {
            "id": "HAIZ-ENU-2026",
            "origin_wgs84": twin_frame["origin"]["wgs84"],
            "north_bearing_deg": 319.0,
            "ccw_from_true_north_deg": 41.0,
            "status": twin_frame["status"],
            "blender_to_threejs": "three_x = spec_x; three_y = spec_z; three_z = -spec_y",
            "legacy_tree_pivot_spec": [38.91, 17.67],
            "datum_note": "z = 0.0 m at Teaching Block 1 forecourt road; lawn = 0.15 m; plaza = 0.60 m; Block 1 floor = 1.05 m (estimated from photo risers)",
        },
        "districts": [
            {"id": "d01_axis_forecourt", "name": "中轴礼仪前庭区", "priority": 0, "center": [6.0, 42.0], "radius": 95.0, "has_lod1": True},
            {"id": "d02_academic_core", "name": "教学与科学核区", "priority": 1, "center": [4.0, -72.0], "radius": 115.0, "has_lod1": True},
            {"id": "d03_yanchi_arts", "name": "砚池与艺术中心区", "priority": 1, "center": [30.0, -138.0], "radius": 75.0, "has_lod1": True},
            {"id": "d04_heritage_gardens", "name": "历史堂馆与图书馆区", "priority": 2, "center": [28.0, 44.0], "radius": 105.0, "has_lod1": True},
            {"id": "d05_sports_living", "name": "运动与生活园区", "priority": 2, "center": [-15.0, -68.0], "radius": 225.0, "has_lod1": True},
            {"id": "d06_fucheng_context", "name": "府城街区天际线背景", "priority": 3, "center": [0.0, -50.0], "radius": 450.0, "has_lod1": False},
        ],
        "school_boundary": school_boundary,
        "levels": twin_site["levels"],
        "forecourt_site": {
            "zones": twin_site["zones"],
            "steps": twin_site["steps"],
            "hedges": twin_site["hedges"],
            "taihu": twin_site["taihu"],
        },
        "gate_north": twin_gate,
        "yihao_spec": twin_yihao,
        "terminalia_hero": twin_trees["lanren"],
        "yanchi": {
            "poly": yanchi_poly,
            **poly_stats(yanchi_poly),
            **twin_yanchi,
        },
        "buildings": buildings,
        "context_buildings": context_buildings,
        "sports_and_landuse": sports_features,
        "roads": roads,
        "vistas": vistas,
        "thermals": thermals,
        "provenance_policy": {
            "tags": ["surveyed", "public-map", "documented", "photo-derived", "estimated", "invented"],
            "surveyed_count": 0,
            "note": "No field survey exists yet; every element carries an honest credibility tag and evidence basis in glTF extras and world_spec.json. No student PII or security/access interior data is collected or modeled.",
        },
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(spec, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {OUT}")
    print(f"  Campus buildings: {len(buildings)}")
    print(f"  Fucheng context buildings (OSM): {len(context_buildings)}")
    print(f"  Sports & land-use features: {len(sports_features)}")
    print(f"  Roads: {len(roads)}, Vistas: {len(vistas)}, Thermals: {len(thermals)}")
    by_d = {}
    for b in buildings:
        by_d[b["district"]] = by_d.get(b["district"], 0) + 1
    for k, v in sorted(by_d.items()):
        print(f"    {k}: {v} buildings")


if __name__ == "__main__":
    main()