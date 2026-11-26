#!/usr/bin/env python3
"""
HAIZ World Reconstruction — Deterministic Blender 5.2+ Master Scene & District Exporter.

Usage:
  blender --background --factory-startup --python-exit-code 1 \
      --python world-reconstruction/pipeline/blender/build_world.py -- [--renders]

Produces:
  1) Editable master Blender file:
       world-reconstruction/assets/blend/HAIZ_World_Master.blend
  2) Streamable compressed WebP+Draco district GLBs (LOD0 + LOD1):
       world-reconstruction/assets/districts/d01_axis_forecourt_lod{0,1}.glb
       world-reconstruction/assets/districts/d02_academic_core_lod{0,1}.glb
       world-reconstruction/assets/districts/d03_yanchi_arts_lod{0,1}.glb
       world-reconstruction/assets/districts/d04_heritage_gardens_lod{0,1}.glb
       world-reconstruction/assets/districts/d05_sports_living_lod{0,1}.glb
       world-reconstruction/assets/districts/d06_fucheng_context.glb
       world-reconstruction/assets/districts/terrain_campus.glb
       world-reconstruction/assets/districts/flora_kit.glb
       world-reconstruction/assets/districts/props_kit.glb
  3) GPU instance transforms & build manifest:
       world-reconstruction/data/instances.json
       world-reconstruction/data/build-manifest.json
  4) Optional multi-angle EEVEE inspection renders (--renders):
       world-reconstruction/assets/renders/*.png
"""
from __future__ import annotations

import hashlib
import json
import math
import sys
import time
from pathlib import Path

# Add sibling blender modules to sys.path
SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import bpy
from mathutils import Vector, Matrix

from materials import build_material_library
from arch_kit import MeshBuilder
from landmarks import (
    build_north_gate,
    build_south_gate,
    build_yihao,
    build_taihu_and_forecourt,
    build_centenary_terminalia,
    build_yanchi_and_arts,
    build_library,
    build_lingnan_green_hall,
    build_pavilion,
    build_alumni_hall,
    build_keji,
    build_stadium_grandstand,
)
from flora_kit import build_flora_kit, build_props_kit, generate_campus_instances

ROOT = SCRIPT_DIR.parents[2]
WR = ROOT / "world-reconstruction"
SPEC_PATH = WR / "data" / "world_spec.json"
DIST_DIR = WR / "assets" / "districts"
BLEND_DIR = WR / "assets" / "blend"
RENDER_DIR = WR / "assets" / "renders"


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 1.0


def make_collection(name: str, parent=None) -> bpy.types.Collection:
    c = bpy.data.collections.new(name)
    if parent is None:
        bpy.context.scene.collection.children.link(c)
    else:
        parent.children.link(c)
    return c


def build_campus_terrain(spec: dict, mats: dict, coll: bpy.types.Collection) -> bpy.types.Object:
    """
    Build unified multi-elevation campus terrain & urban base:
      - Surrounding Fucheng ground apron (-600..+600)
      - Campus turf base inside boundary (z = 0.15 m)
      - Connected asphalt & stone campus road network with kerbs (z = 0.04 m)
      - Forecourt diamond-dot central plaza & staggered dark-granite side plazas (z = 0.60 m)
      - Forecourt lawns (z = 0.15 m) & asphalt forecourt road (z = 0.0 m)
      - 400m terracotta track + football pitch + white lane lines + goals
      - 6 green-and-red basketball courts + 3 terracotta volleyball courts
      - Botanical garden shaded paths & tranquil garden pond
      - Perimeter campus wall with emerald glazed tile coping
    """
    mb = MeshBuilder(mats)

    # 1. Broad Fucheng urban ground plane (z = -0.05) + campus lawn sheet (z = 0.12)
    # Build lawn sheet in clean non-overlapping bands AROUND Yanchi pond (x=37..64, y=-130..-108)
    # so Yanchi's sunken reflective water basin (z = -0.30) is 100% open and never covered!
    mb.add_quad((-700, -750, -0.48), (700, -750, -0.48), (700, 650, -0.48), (-700, 650, -0.48), "mat_ground_concrete", uv_scale=0.04)
    # Campus lawn bands with clean cutout around Yanchi [37.0..64.0] x [-130.2..-108.0]
    mb.add_quad((-255, -108.0, 0.12), (240, -108.0, 0.12), (240, 134, 0.12), (-255, 134, 0.12), "mat_ground_lawn", uv_scale=0.05)
    mb.add_quad((-255, -262, 0.12), (240, -262, 0.12), (240, -130.2, 0.12), (-255, -130.2, 0.12), "mat_ground_lawn", uv_scale=0.05)
    mb.add_quad((-255, -130.2, 0.12), (37.0, -130.2, 0.12), (37.0, -108.0, 0.12), (-255, -108.0, 0.12), "mat_ground_lawn", uv_scale=0.05)
    mb.add_quad((64.0, -130.2, 0.12), (240, -130.2, 0.12), (240, -108.0, 0.12), (64.0, -108.0, 0.12), "mat_ground_lawn", uv_scale=0.05)
    # Surrounding Fucheng urban paving ring outside campus
    mb.add_quad((-700, 134, -0.02), (700, 134, -0.02), (700, 650, -0.02), (-700, 650, -0.02), "mat_ground_concrete", uv_scale=0.04)
    mb.add_quad((-700, -750, -0.02), (700, -750, -0.02), (700, -262, -0.02), (-700, -262, -0.02), "mat_ground_concrete", uv_scale=0.04)
    mb.add_quad((-700, -262, -0.02), (-255, -262, -0.02), (-255, 134, -0.02), (-700, 134, -0.02), "mat_ground_concrete", uv_scale=0.04)
    mb.add_quad((240, -262, -0.02), (700, -262, -0.02), (700, 134, -0.02), (240, 134, -0.02), "mat_ground_concrete", uv_scale=0.04)
    sb = spec["school_boundary"]

    # 2. Connected campus roads (cleanly above 0.12 lawn base, below 0.16 lawn islands & 0.60 granite plaza)
    for rd in spec["roads"]:
        pts = rd["pts"]
        hw = rd["width"] * 0.5
        smat = "mat_paving_asphalt" if rd["surface"] == "asphalt" else "mat_ground_concrete"
        rz = 0.145 if rd["id"] in ("axis_avenue", "forecourt_east_west", "north_street") else 0.155
        for a, b in zip(pts[:-1], pts[1:]):
            dx, dy = b[0] - a[0], b[1] - a[1]
            L = math.hypot(dx, dy)
            if L < 0.5:
                continue
            nx, ny = -dy / L, dx / L
            # Road deck
            mb.add_quad(
                (a[0] - nx * hw, a[1] - ny * hw, rz),
                (b[0] - nx * hw, b[1] - ny * hw, rz),
                (b[0] + nx * hw, b[1] + ny * hw, rz),
                (a[0] + nx * hw, a[1] + ny * hw, rz),
                smat, uv_scale=0.14, ensure_dir=Vector((0, 0, 1))
            )
            # Raised light stone kerbs on both flanks
            for side in (-1.0, 1.0):
                k0 = hw * side
                k1 = (hw + 0.35) * side
                if k0 > k1:
                    k0, k1 = k1, k0
                mb.add_quad(
                    (a[0] + nx * k0, a[1] + ny * k0, rz + 0.05),
                    (b[0] + nx * k0, b[1] + ny * k0, rz + 0.05),
                    (b[0] + nx * k1, b[1] + ny * k1, rz + 0.05),
                    (a[0] + nx * k1, a[1] + ny * k1, rz + 0.05),
                    "mat_stone_granite_grey", uv_scale=0.25, ensure_dir=Vector((0, 0, 1))
                )

    # 3. Calibrated Forecourt Plazas, Apron & Lawns
    # Dark asphalt apron & forecourt carriageway (z = 0.145, cleanly visible above lawn base!)
    mb.add_box((-78.0, 42.6, 0.02), (78.0, 50.2, 0.148), "mat_paving_asphalt", skip=("-z",), uv_scale=0.14)
    mb.add_box((-12.5, 29.8, 0.02), (12.5, 42.6, 0.148), "mat_paving_asphalt", skip=("-z",), uv_scale=0.14)
    # North gate granite threshold apron
    mb.add_box((-9.0, 96.0, 0.02), (9.0, 120.0, 0.152), "mat_stone_granite_grey", skip=("-z",), uv_scale=0.20)
    # Central light diamond-dot granite plaza (z = 0.60)
    mb.add_box((-14.5, -0.3, 0.0), (14.5, 20.5, 0.60), "mat_paving_plaza_diamond", skip=("-z",), uv_scale=0.18)
    mb.add_box((-12.5, 20.5, 0.0), (12.5, 29.8, 0.60), "mat_paving_plaza_diamond", skip=("-z",), uv_scale=0.18)
    # East & West staggered dark-granite side plazas under the Centenary Terminalia (z = 0.60)
    mb.add_box((14.5, -0.3, 0.0), (52.0, 20.5, 0.60), "mat_paving_side_stagger", skip=("-z",), uv_scale=0.20)
    mb.add_box((52.0, -0.3, 0.0), (58.0, 9.0, 0.60), "mat_paving_side_stagger", skip=("-z",), uv_scale=0.20)
    mb.add_box((-36.0, -0.3, 0.0), (-14.5, 20.5, 0.60), "mat_paving_side_stagger", skip=("-z",), uv_scale=0.20)
    mb.add_box((-58.0, -0.3, 0.0), (-36.0, 9.0, 0.60), "mat_paving_side_stagger", skip=("-z",), uv_scale=0.20)
    # Forecourt side lawns & crisp white stone footpath borders (raised slightly to 0.20m)
    for lx0, lx1 in [(-64.0, -13.0), (13.0, 64.0)]:
        mb.add_box((lx0, 9.0, 0.12), (lx1, 40.5, 0.21), "mat_ground_lawn", skip=("-z",), uv_scale=0.08)
        mb.add_box((lx0 - 2.2, 40.5, 0.12), (lx1 + 2.2, 42.6, 0.20), "mat_ground_concrete", skip=("-z",))

    # Inner courtyard paved walkways (Block 1-2 court, Zhuangyuan Plaza, Yanchi promenade, Library forecourt)
    mb.add_box((-48.0, -45.0, 0.08), (48.0, -12.0, 0.15), "mat_ground_concrete", skip=("-z",), uv_scale=0.15)
    mb.add_box((-20.0, -39.0, 0.15), (20.0, -18.0, 0.22), "mat_ground_lawn", skip=("-z",), uv_scale=0.12)
    mb.add_box((-32.0, -78.0, 0.08), (58.0, -56.0, 0.15), "mat_paving_plaza_diamond", skip=("-z",), uv_scale=0.14)
    # Yanchi & Art Center brick/granite plaza promenade framed cleanly AROUND Yanchi pond (leaving pond open!)
    mb.add_box((22.0, -133.5, 0.08), (37.0, -104.5, 0.15), "mat_paving_side_stagger", skip=("-z",), uv_scale=0.18)
    mb.add_box((64.0, -133.5, 0.08), (68.0, -104.5, 0.15), "mat_paving_side_stagger", skip=("-z",), uv_scale=0.18)
    mb.add_box((37.0, -108.0, 0.08), (64.0, -104.5, 0.15), "mat_paving_side_stagger", skip=("-z",), uv_scale=0.18)
    mb.add_box((37.0, -133.5, 0.08), (64.0, -130.2, 0.15), "mat_paving_side_stagger", skip=("-z",), uv_scale=0.18)

    # 4. Sports Facilities: 400m Track + Football Pitch + 6 Basketball Courts + 3 Volleyball Courts
    for sf in spec["sports_and_landuse"]:
        kind = sf["kind"]
        x0, y0, x1, y1 = sf["bbox"]
        cx, cy = 0.5 * (x0 + x1), 0.5 * (y0 + y1)
        if kind == "stadium_track":
            # Authentic rounded stadium 8-lane terracotta track + mowed football infield + white markings!
            L = 42.0  # straight half-length
            R_out = 44.5
            R_in = 35.5
            segs = 24
            # Build outer red track & inner green football pitch polygons
            out_pts = []
            in_pts = []
            for k in range(segs):
                a = -math.pi * 0.5 + (k / (segs - 1)) * math.pi
                out_pts.append((cx + L + R_out * math.cos(a), cy + R_out * math.sin(a), 0.16))
                in_pts.append((cx + L + R_in * math.cos(a), cy + R_in * math.sin(a), 0.18))
            for k in range(segs):
                a = math.pi * 0.5 + (k / (segs - 1)) * math.pi
                out_pts.append((cx - L + R_out * math.cos(a), cy + R_out * math.sin(a), 0.16))
                in_pts.append((cx - L + R_in * math.cos(a), cy + R_in * math.sin(a), 0.18))
            mb.add_poly(out_pts, "mat_track_red", uv_scale=0.05)
            mb.add_poly(in_pts, "mat_ground_lawn", uv_scale=0.06)
            # Crisp white football pitch lines + center line + penalty boxes + goalposts
            px0, px1, py0, py1 = cx - 48.0, cx + 48.0, cy - 30.0, cy + 30.0
            lz = 0.21
            lw = 0.28
            mb.add_quad((px0, py0, lz), (px1, py0, lz), (px1, py0 + lw, lz), (px0, py0 + lw, lz), "mat_line_white")
            mb.add_quad((px0, py1 - lw, lz), (px1, py1 - lw, lz), (px1, py1, lz), (px0, py1, lz), "mat_line_white")
            mb.add_quad((px0, py0, lz), (px0 + lw, py0, lz), (px0 + lw, py1, lz), (px0, py1, lz), "mat_line_white")
            mb.add_quad((px1 - lw, py0, lz), (px1, py0, lz), (px1, py1, lz), (px1 - lw, py1, lz), "mat_line_white")
            mb.add_quad((cx - lw * 0.5, py0, lz), (cx + lw * 0.5, py0, lz), (cx + lw * 0.5, py1, lz), (cx - lw * 0.5, py1, lz), "mat_line_white")
            # Goalposts
            for gx in (px0, px1):
                mb.add_cylinder((gx, cy - 3.66), 0.08, 0.08, 0.18, 2.62, "mat_trim_white", segs=6)
                mb.add_cylinder((gx, cy + 3.66), 0.08, 0.08, 0.18, 2.62, "mat_trim_white", segs=6)
                mb.add_box((gx - 0.08, cy - 3.66, 2.52), (gx + 0.08, cy + 3.66, 2.66), "mat_trim_white")
        elif kind == "basketball_court":
            # Authentic red apron + vibrant green inner court matching aerial_campus.jpg!
            mb.add_box((x0, y0, 0.12), (x1, y1, 0.17), "mat_court_red", skip=("-z",))
            mb.add_box((x0 + 1.1, y0 + 1.6, 0.17), (x1 - 1.1, y1 - 1.6, 0.19), "mat_court_green", skip=("-z",))
            # White court boundary & midcourt line
            lz = 0.21
            mb.add_quad((x0 + 1.1, cy - 0.10, lz), (x1 - 1.1, cy - 0.10, lz), (x1 - 1.1, cy + 0.10, lz), (x0 + 1.1, cy + 0.10, lz), "mat_line_white")
            mb.add_cylinder((cx, cy), 1.85, 1.85, lz, lz + 0.015, "mat_court_red", segs=16)
        elif kind == "volleyball_court":
            mb.add_box((x0, y0, 0.12), (x1, y1, 0.18), "mat_court_red", skip=("-z",))
            mb.add_quad((x0 + 0.8, cy - 0.09, 0.20), (x1 - 0.8, cy - 0.09, 0.20), (x1 - 0.8, cy + 0.09, 0.20), (x0 + 0.8, cy + 0.09, 0.20), "mat_line_white")

    # 5. Botanical Garden Pond & Winding Garden Walkways (southwest campus)
    mb.add_cylinder((-132.0, -164.0), 8.2, 8.2, -0.30, 0.08, "mat_water_yanchi", segs=18)
    mb.add_cylinder((-132.0, -164.0), 8.9, 8.9, 0.08, 0.22, "mat_stone_granite_grey", segs=18, caps=(False, False))

    # 6. Perimeter Campus Wall along real OSM School Boundary (leaving North & South Gate openings!)
    for a, b in zip(sb, sb[1:] + sb[:1]):
        mx, my = 0.5 * (a[0] + b[0]), 0.5 * (a[1] + b[1])
        # Skip immediate North Gate & South Gate portals
        if (abs(mx) < 18.0 and my > 95.0) or (abs(mx + 66.0) < 14.0 and my < -248.0):
            continue
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dy)
        if L < 1.0:
            continue
        ang = math.atan2(dy, dx)
        xf = Matrix.Translation((a[0], a[1], 0.0)) @ Matrix.Rotation(ang, 4, "Z")
        mb.add_box((0.0, -0.18, 0.0), (L, 0.18, 2.35), "mat_wall_ivory", skip=("-z",), xform=xf)
        mb.add_box((0.0, -0.30, 2.35), (L, 0.30, 2.65), "mat_roof_emerald", xform=xf)

    return mb.finalize(
        "campus_terrain_unified", coll,
        extras={
            "haiz_district": "terrain",
            "haiz_tag": "public-map/photo-derived",
            "haiz_basis": "Unified HAIZ-ENU-2026 terrain: OSM school boundary, calibrated forecourt plazas, connected campus roads, OSM 400m track & 6 basketball courts",
            "haiz_name": "府城校区统一地形、校道与运动场",
        }
    )


def build_generic_campus_building(b: dict, mats: dict, coll: bpy.types.Collection, lod: int = 0) -> bpy.types.Object:
    """Build non-hero campus buildings from exact OSM footprints using matched Hainan architectural archetypes."""
    mb = MeshBuilder(mats)
    arch = b["archetype"]
    floors = b.get("floors", 4)
    total_h = b.get("height", floors * 3.4)
    storey_h = max(2.8, (total_h - 0.45) / max(1, floors))

    pal = b.get("wall_palette", "ivory_stucco")
    wall_map = {
        "ivory_stucco": "mat_wall_ivory",
        "coral_terracotta": "mat_wall_coral",
        "pale_ceramic_tile": "mat_wall_pale_tile",
        "warm_cream_tile": "mat_wall_pale_tile",
        "white_coral_plinth": "mat_wall_ivory",
    }
    wall_mat = wall_map.get(pal, "mat_wall_ivory")
    plinth_mat = "mat_wall_coral" if pal == "white_coral_plinth" else None

    if arch in ("skybridge", "covered_walk"):
        # Clean elevated skybridge with open breezeway railings
        x0, y0, x1, y1 = b["bbox"]
        # Trim slightly along Y so bridges join cleanly without Z-fighting main facades!
        y0_c = y0 + 0.25
        y1_c = y1 - 0.25
        if y1_c <= y0_c + 1.0:
            y0_c, y1_c = y0, y1
        z_start = 4.6 if arch == "skybridge" else 0.15
        n_fl = max(1, floors - (1 if arch == "skybridge" else 0))
        # Supporting columns beneath skybridge
        if arch == "skybridge":
            for sx in (x0 + 0.5, x1 - 0.5):
                for sy in (y0_c + 2.5, 0.5 * (y0_c + y1_c), y1_c - 2.5):
                    mb.add_box((sx - 0.3, sy - 0.3, 0.15), (sx + 0.3, sy + 0.3, z_start), "mat_trim_white")
        for f in range(n_fl):
            zf = z_start + f * 3.39
            mb.add_box((x0, y0_c, zf), (x1, y1_c, zf + 0.32), "mat_trim_white")
            # Low parapet side rails + open air breezeway
            mb.add_box((x0, y0_c, zf + 0.32), (x0 + 0.22, y1_c, zf + 1.25), "mat_wall_ivory")
            mb.add_box((x1 - 0.22, y0_c, zf + 0.32), (x1, y1_c, zf + 1.25), "mat_wall_ivory")
        mb.add_box((x0, y0_c, z_start + n_fl * 3.39), (x1, y1_c, z_start + n_fl * 3.39 + 0.45), "mat_trim_white")
    else:
        mb.add_polygon_building(
            b["poly"], z0=0.15, floors=floors, storey_h=storey_h,
            wall_mat=wall_mat, plinth_mat=plinth_mat,
            roof_style=b.get("roof_style", "flat_parapet"),
            archetype=arch, lod=lod
        )

    return mb.finalize(
        b["id"], coll,
        extras={
            "haiz_building_id": b["id"],
            "haiz_district": b["district"],
            "haiz_tag": b["tag"],
            "haiz_basis": b["basis"],
            "haiz_name": b["name"],
        }
    )


def build_fucheng_context(spec: dict, mats: dict, coll: bpy.types.Collection) -> bpy.types.Object:
    """Build all 133 real OSM surrounding Fucheng (海口府城) city buildings in warm tropical palettes."""
    mb = MeshBuilder(mats)
    ctx_mats = ["mat_ctx_cream", "mat_ctx_ochre", "mat_ctx_rose", "mat_ctx_sage", "mat_ctx_stone"]
    for cb in spec["context_buildings"]:
        pts = cb["poly"]
        h = cb["height"]
        wmat = ctx_mats[cb["palette"] % len(ctx_mats)]
        n = len(pts)
        # Extruded wall shell + subtle top cornice + flat roof
        for i in range(n):
            a, b = pts[i], pts[(i + 1) % n]
            mb.add_quad((a[0], a[1], -0.05), (b[0], b[1], -0.05), (b[0], b[1], h), (a[0], a[1], h), wmat, uv_scale=0.12)
        mb.add_poly([(p[0], p[1], h) for p in pts], "mat_roof_flat", uv_scale=0.08)
    return mb.finalize(
        "fucheng_city_context", coll,
        extras={
            "haiz_district": "d06_fucheng_context",
            "haiz_tag": "public-map/invented",
            "haiz_basis": "133 real Overture/OSM building footprints surrounding Hainan Middle School in Fucheng, Qiongshan; storeys & southern urban palettes estimated for authentic skyline",
            "haiz_name": "府城琼山周边街区天际线",
        }
    )


def build_district_geometry(spec: dict, mats: dict, district_id: str, coll: bpy.types.Collection, lod: int = 0):
    """Build all meshes belonging to a specific district at the requested LOD (0 = full, 1 = simplified)."""
    if district_id == "d01_axis_forecourt":
        build_north_gate(spec, mats, coll, lod=lod)
        build_yihao(spec, mats, coll, lod=lod)
        build_taihu_and_forecourt(spec, mats, coll, lod=lod)
        build_centenary_terminalia(spec, mats, coll, lod=lod)
        return

    if district_id == "d03_yanchi_arts":
        build_yanchi_and_arts(spec, mats, coll, lod=lod)
        return

    if district_id == "d06_fucheng_context":
        build_fucheng_context(spec, mats, coll)
        return

    for b in spec["buildings"]:
        if b["district"] != district_id:
            continue
        arch = b["archetype"]
        if arch == "hero_library":
            build_library(spec, mats, coll, lod=lod)
        elif arch == "lingnan_green_hall":
            build_lingnan_green_hall(b, mats, coll, lod=lod)
        elif arch == "hero_pavilion":
            build_pavilion(b, mats, coll, lod=lod)
        elif arch == "hero_alumni":
            build_alumni_hall(b, mats, coll, lod=lod)
        elif arch == "hero_keji":
            build_keji(b, mats, coll, lod=lod)
        elif arch == "hero_south_gate":
            build_south_gate(spec, mats, coll, lod=lod)
        elif arch == "stadium_grandstand":
            build_stadium_grandstand(b, mats, coll, lod=lod)
        else:
            build_generic_campus_building(b, mats, coll, lod=lod)


def export_collection_glb(coll: bpy.types.Collection, out_path: Path, use_draco: bool = True) -> dict:
    """Export a single Blender collection to an optimized WebP + Draco glTF binary (.glb)."""
    bpy.ops.object.select_all(action="DESELECT")
    objs = [o for o in coll.all_objects if o.type == "MESH"]
    tris = 0
    mat_set = set()
    for o in objs:
        o.select_set(True)
        mesh = o.data
        mesh.calc_loop_triangles()
        tris += len(mesh.loop_triangles)
        for m in mesh.materials:
            if m:
                mat_set.add(m.name)
    if objs:
        bpy.context.view_layer.objects.active = objs[0]

    out_path.parent.mkdir(parents=True, exist_ok=True)
    kwargs = dict(
        filepath=str(out_path),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_extras=True,
        export_image_format="WEBP",
        export_image_quality=82,
        export_draco_mesh_compression_enable=use_draco,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
    )
    try:
        bpy.ops.export_scene.gltf(**kwargs)
    except TypeError:
        # Fallback if a specific Blender minor parameter differs
        kwargs.pop("export_image_quality", None)
        bpy.ops.export_scene.gltf(**kwargs)

    size_bytes = out_path.stat().st_size
    sha = hashlib.sha256(out_path.read_bytes()).hexdigest()[:16]
    return {
        "file": out_path.name,
        "bytes": size_bytes,
        "kb": round(size_bytes / 1024.0, 1),
        "objects": len(objs),
        "triangles": tris,
        "materials": len(mat_set),
        "sha256_prefix": sha,
    }


def render_inspection_views(spec: dict, mats: dict, instances: dict):
    """Render quick sunlit multi-angle Blender EEVEE verification shots directly from the master scene."""
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene

    # Try EEVEE Next / EEVEE for fast high-craft Apple Silicon GPU inspection renders
    for eng in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "CYCLES"):
        try:
            scene.render.engine = eng
            break
        except TypeError:
            continue
    print("Inspection render engine:", scene.render.engine)

    # Golden afternoon tropical sky + warm Haikou sun
    world = bpy.data.worlds.new("HAIZ_Golden_Sky")
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    sky = nt.nodes.new("ShaderNodeTexSky")
    valid_sky = [it.identifier for it in sky.bl_rna.properties["sky_type"].enum_items]
    for pref in ("MULTIPLE_SCATTERING", "SINGLE_SCATTERING", "NISHITA", "HOSEK_WILKIE"):
        if pref in valid_sky:
            sky.sky_type = pref
            break
    if hasattr(sky, "sun_elevation"):
        sky.sun_elevation = math.radians(24.0)
    if hasattr(sky, "sun_rotation"):
        sky.sun_rotation = math.radians(235.0)
    if hasattr(sky, "air_density"):
        sky.air_density = 1.2
    if hasattr(sky, "dust_density"):
        sky.dust_density = 1.4
    bg.inputs["Strength"].default_value = 0.09
    nt.links.new(sky.outputs["Color"], bg.inputs["Color"])
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])

    # Sun light
    sun_data = bpy.data.lights.new("HaikouSun", type="SUN")
    sun_data.energy = 3.2
    sun_data.color = (1.0, 0.91, 0.78)
    sun_obj = bpy.data.objects.new("HaikouSun", sun_data)
    scene.collection.objects.link(sun_obj)
    sun_obj.rotation_euler = (math.radians(56.0), math.radians(10.0), math.radians(220.0))

    # Populate a clean temporary preview collection of instanced palms/trees for renders!
    prev_coll = make_collection("_preview_instances")
    flora_map = {o["haiz_archetype"]: o.data for o in bpy.data.objects if "haiz_archetype" in o}
    for arch_name, arr in instances["flora"].items():
        mesh = flora_map.get(arch_name)
        if not mesh:
            continue
        for idx, (x, y, z, sc, rot) in enumerate(arr):
            ob = bpy.data.objects.new(f"inst_{arch_name}_{idx}", mesh)
            ob.location = (x, y, z)
            ob.scale = (sc, sc, sc)
            ob.rotation_euler = (0.0, 0.0, rot)
            prev_coll.objects.link(ob)

    # Camera setup
    cam_data = bpy.data.cameras.new("InspectCam")
    cam_data.lens = 30.0
    cam_data.clip_end = 2000.0
    cam_obj = bpy.data.objects.new("InspectCam", cam_data)
    scene.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    scene.render.resolution_x = 1280
    scene.render.resolution_y = 720
    scene.render.image_settings.file_format = "JPEG"
    scene.render.image_settings.quality = 88
    if hasattr(scene.view_settings, "view_transform"):
        try:
            scene.view_settings.view_transform = "AgX"
        except TypeError:
            pass

    shots = [
        ("01_north_gate_axis", (0.0, 125.0, 2.5), (0.0, 40.0, 6.2), 34.0),
        ("02_forecourt_yihao_terminalia", (-14.0, 47.0, 4.2), (10.0, 4.0, 8.0), 26.0),
        ("03_yanchi_arts", (62.5, -105.0, 4.2), (35.0, -126.0, 3.0), 28.0),
        ("04_library_observatory", (64.0, 34.0, 6.5), (98.0, 4.0, 10.5), 26.0),
        ("05_aerial_full_campus", (55.0, 190.0, 118.0), (-12.0, -45.0, 4.0), 26.0),
    ]
    for sname, pos, tgt, lens in shots:
        cam_data.lens = lens
        cam_obj.location = Vector(pos)
        direction = Vector(tgt) - Vector(pos)
        cam_obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = str(RENDER_DIR / f"{sname}.jpg")
        bpy.ops.render.render(write_still=True)
        print(f"  Rendered {sname}.jpg")

    # Clean up temporary preview instances before saving clean editable master .blend
    for ob in list(prev_coll.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    bpy.data.collections.remove(prev_coll)


def main():
    t0 = time.time()
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    do_renders = "--renders" in args

    spec = json.loads(SPEC_PATH.read_text(encoding="utf-8"))
    clear_scene()
    mats = build_material_library()

    manifest = {
        "schema": "haiz-world-build-manifest/1",
        "blender_version": bpy.app.version_string,
        "built_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "frame": spec["frame"]["id"],
        "exports": {},
        "totals": {},
    }

    # 1. Build Master LOD0 Scene Collections (kept in HAIZ_World_Master.blend for clean future editing!)
    terrain_coll = make_collection("00_Terrain_Campus")
    build_campus_terrain(spec, mats, terrain_coll)
    manifest["exports"]["terrain_campus"] = export_collection_glb(terrain_coll, DIST_DIR / "terrain_campus.glb")

    district_colls = {}
    for d in spec["districts"]:
        did = d["id"]
        c_lod0 = make_collection(f"LOD0_{did}")
        build_district_geometry(spec, mats, did, c_lod0, lod=0)
        district_colls[did] = c_lod0
        fname = f"{did}_lod0.glb" if d["has_lod1"] else f"{did}.glb"
        manifest["exports"][fname.replace(".glb", "")] = export_collection_glb(c_lod0, DIST_DIR / fname)

    # 2. Build & Export GPU-Instanced Flora & Props Kits
    flora_coll = make_collection("90_Kit_Flora")
    build_flora_kit(mats, flora_coll)
    manifest["exports"]["flora_kit"] = export_collection_glb(flora_coll, DIST_DIR / "flora_kit.glb")

    props_coll = make_collection("91_Kit_Props")
    build_props_kit(mats, props_coll)
    manifest["exports"]["props_kit"] = export_collection_glb(props_coll, DIST_DIR / "props_kit.glb")

    # 3. Generate deterministic campus instance placement JSON
    instances = generate_campus_instances(spec)
    inst_path = WR / "data" / "instances.json"
    inst_path.write_text(json.dumps(instances, ensure_ascii=False), encoding="utf-8")
    manifest["instances_summary"] = {
        "flora": {k: len(v) for k, v in instances["flora"].items()},
        "props": {k: len(v) for k, v in instances["props"].items()},
    }

    # 4. Optional Blender inspection renders (while kits are hidden off-origin or moved cleanly)
    if do_renders:
        for o in list(flora_coll.objects) + list(props_coll.objects):
            o.hide_render = True
        render_inspection_views(spec, mats, instances)
        for o in list(flora_coll.objects) + list(props_coll.objects):
            o.hide_render = False

    # 5. Save Clean Editable Master .blend (with all packed shared PBR textures & organized LOD0 collections!)
    BLEND_DIR.mkdir(parents=True, exist_ok=True)
    master_blend = BLEND_DIR / "HAIZ_World_Master.blend"
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(master_blend), compress=True)
    manifest["master_blend"] = {
        "file": "assets/blend/HAIZ_World_Master.blend",
        "bytes": master_blend.stat().st_size,
        "mb": round(master_blend.stat().st_size / (1024 * 1024), 2),
    }

    # 6. Build & Export Lightweight LOD1 Distant District Proxies (without cluttering Master .blend)
    for d in spec["districts"]:
        if not d["has_lod1"]:
            continue
        did = d["id"]
        c_lod1 = make_collection(f"_tmp_LOD1_{did}")
        build_district_geometry(spec, mats, did, c_lod1, lod=1)
        manifest["exports"][f"{did}_lod1"] = export_collection_glb(c_lod1, DIST_DIR / f"{did}_lod1.glb")
        for o in list(c_lod1.objects):
            bpy.data.objects.remove(o, do_unlink=True)
        bpy.data.collections.remove(c_lod1)

    # Compute Totals & Budgets
    lod0_bytes = sum(v["bytes"] for k, v in manifest["exports"].items() if not k.endswith("_lod1"))
    lod0_tris = sum(v["triangles"] for k, v in manifest["exports"].items() if not k.endswith("_lod1"))
    lod1_bytes = sum(v["bytes"] for k, v in manifest["exports"].items() if k.endswith("_lod1"))
    manifest["totals"] = {
        "lod0_all_districts_mb": round(lod0_bytes / (1024 * 1024), 2),
        "lod0_all_districts_triangles": lod0_tris,
        "lod1_proxies_mb": round(lod1_bytes / (1024 * 1024), 2),
        "all_runtime_glb_mb": round((lod0_bytes + lod1_bytes) / (1024 * 1024), 2),
        "build_seconds": round(time.time() - t0, 2),
    }

    man_path = WR / "data" / "build-manifest.json"
    man_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    print("\n=== HAIZ WORLD RECONSTRUCTION BUILD COMPLETE ===")
    print(f"Elapsed: {manifest['totals']['build_seconds']} s")
    print(f"Master .blend: {manifest['master_blend']['mb']} MB")
    print(f"LOD0 full campus GLBs: {manifest['totals']['lod0_all_districts_mb']} MB ({manifest['totals']['lod0_all_districts_triangles']:,} tris)")
    print(f"LOD1 proxy GLBs:       {manifest['totals']['lod1_proxies_mb']} MB")
    for k, v in manifest["exports"].items():
        print(f"  {v['file']:32s}  {v['kb']:7.1f} KB   {v['triangles']:7,d} tris   {v['objects']:2d} objs")


if __name__ == "__main__":
    main()
