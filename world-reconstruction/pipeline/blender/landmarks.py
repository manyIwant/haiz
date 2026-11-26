"""
HAIZ World Reconstruction — Hero Landmark Builders.

Each hero landmark is built directly from calibrated measurements and photographic
references in world_spec.json, preserving authentic silhouettes, proportions, depth,
inscriptions, and provenance metadata (extras.haiz_tag / extras.haiz_basis).
"""
from __future__ import annotations

import math
import numpy as np
import bpy
import bmesh
from mathutils import Vector, Matrix

from arch_kit import MeshBuilder


def _add_stone_lion(mb: MeshBuilder, cx: float, cy: float, z0: float, face_dir: float = 1.0, lod: int = 0):
    """Sculpted pale-marble guardian stone lion on tiered pedestal (hero-2560.jpg)."""
    m = "mat_stone_lion"
    # Tiered square pedestal (0.8m x 0.8m x 0.95m)
    mb.add_box((cx - 0.44, cy - 0.44, z0), (cx + 0.44, cy + 0.44, z0 + 0.18), m, skip=("-z",))
    mb.add_box((cx - 0.36, cy - 0.36, z0 + 0.18), (cx + 0.36, cy + 0.36, z0 + 0.82), m, skip=("-z",))
    mb.add_box((cx - 0.42, cy - 0.42, z0 + 0.82), (cx + 0.42, cy + 0.42, z0 + 0.96), m)
    if lod >= 1:
        mb.add_cylinder((cx, cy), 0.28, 0.20, z0 + 0.96, z0 + 1.92, m, segs=8)
        return
    # Seated lion body: plinth, muscular chest, haunches, head, mane, forelegs
    zb = z0 + 0.96
    mb.add_box((cx - 0.30, cy - 0.32, zb), (cx + 0.30, cy + 0.32, zb + 0.12), m)
    # Haunches (rear) & chest (front)
    fy = face_dir
    mb.add_cylinder((cx, cy - 0.10 * fy), 0.24, 0.22, zb + 0.10, zb + 0.54, m, segs=10)
    mb.add_cylinder((cx, cy + 0.08 * fy), 0.23, 0.25, zb + 0.36, zb + 0.78, m, segs=10)
    # Forelegs
    for sx in (-0.14, 0.14):
        mb.add_cylinder((cx + sx, cy + 0.18 * fy), 0.075, 0.065, zb + 0.10, zb + 0.56, m, segs=8)
    # Head & curly mane
    mb.add_cylinder((cx, cy + 0.10 * fy), 0.22, 0.19, zb + 0.74, zb + 1.06, m, segs=10)
    mb.add_box((cx - 0.14, cy + (0.14 if fy > 0 else -0.34), zb + 0.76), (cx + 0.14, cy + (0.34 if fy > 0 else -0.14), zb + 0.96), m)


def _add_bronze_statue(mb: MeshBuilder, cx: float, cy: float, z0: float):
    """Granite pedestal + scholarly bronze standing figure (campus_fengqitang.jpg / campus_xiaoyouhui.jpg)."""
    mb.add_box((cx - 0.85, cy - 0.85, z0), (cx + 0.85, cy + 0.85, z0 + 0.16), "mat_stone_granite_grey", skip=("-z",))
    mb.add_box((cx - 0.55, cy - 0.55, z0 + 0.16), (cx + 0.55, cy + 0.55, z0 + 1.32), "mat_stone_granite_dark", skip=("-z",))
    mb.add_box((cx - 0.36, cy - 0.57, z0 + 0.55), (cx + 0.36, cy - 0.54, z0 + 0.95), "mat_paint_vermilion")
    zb = z0 + 1.32
    mb.add_cylinder((cx, cy), 0.28, 0.22, zb, zb + 1.15, "mat_bronze_statue", segs=10)
    mb.add_cylinder((cx, cy), 0.24, 0.18, zb + 1.15, zb + 1.65, "mat_bronze_statue", segs=10)
    mb.add_cylinder((cx, cy), 0.13, 0.11, zb + 1.65, zb + 1.98, "mat_bronze_statue", segs=10)


def _add_3d_numerals_1923(mb: MeshBuilder, cx: float, y_face: float, z_bot: float, h: float = 0.72):
    """Crisp extruded dark-bronze 3D numerals '1923' on Teaching Block 1 granite portal (facing +Y North)."""
    mat = "mat_metal_dark"
    t = 0.11
    d = 0.08
    # Looking south from +Y North Gate: +X is viewer-left, -X is viewer-right!
    def s(x0, z0, x1, z1):
        xa, xb = (x0, x1) if x0 < x1 else (x1, x0)
        mb.add_box((xa, y_face, z_bot + z0 * h), (xb, y_face + d, z_bot + z1 * h), mat)

    w = 0.44
    # Looking south from North Gate (+Y toward -Y): +X is viewer-LEFT, -X is viewer-RIGHT!
    # '1' (viewer leftmost -> +X)
    x = cx + 1.55
    s(x - t * 0.5, 0.0, x + t * 0.5, 1.0)
    s(x + t * 0.5, 0.80, x + 0.22, 0.95)
    # '9' (viewer 2nd: left upper loop stem on +X, full right stem on -X)
    x = cx + 0.52
    s(x - w * 0.5, 0.86, x + w * 0.5, 1.0)
    s(x - w * 0.5, 0.46, x + w * 0.5, 0.58)
    s(x - w * 0.5, 0.0, x + w * 0.5, 0.14)
    s(x + w * 0.5 - t, 0.46, x + w * 0.5, 1.0)   # left upper stem
    s(x - w * 0.5, 0.0, x - w * 0.5 + t, 1.0)    # right full stem
    # '2' (viewer 3rd: right upper stem on -X, left lower stem on +X)
    x = cx - 0.52
    s(x - w * 0.5, 0.86, x + w * 0.5, 1.0)
    s(x - w * 0.5, 0.44, x + w * 0.5, 0.56)
    s(x - w * 0.5, 0.0, x + w * 0.5, 0.14)
    s(x - w * 0.5, 0.44, x - w * 0.5 + t, 1.0)   # right upper stem
    s(x + w * 0.5 - t, 0.0, x + w * 0.5, 0.56)   # left lower stem
    # '3' (viewer rightmost -> -X: right full stem on -X)
    x = cx - 1.55
    s(x - w * 0.5, 0.86, x + w * 0.5, 1.0)
    s(x - w * 0.5, 0.44, x + w * 0.5, 0.56)
    s(x - w * 0.5, 0.0, x + w * 0.5, 0.14)
    s(x - w * 0.5, 0.0, x - w * 0.5 + t, 1.0)    # right full stem


def build_north_gate(spec: dict, mats: dict, coll: bpy.types.Collection, lod: int = 0) -> bpy.types.Object:
    """
    Calibrated North Gate Paifang (海南中學牌坊, hero-2560.jpg / twin/data/gate.json).
    Emerald glazed curved roofs, golden & jade fretwork friezes, gold '海南中學' plaque,
    4 stone guardian lions, boundary walls with green glazed coping, west gatehouse.
    """
    g = spec["gate_north"]
    mb = MeshBuilder(mats)
    cy = g["centre_y"]
    hd = g["depth"] * 0.55

    # Four cream-white piers with dark stone bases and golden ochre horizontal bands
    piers_spec = [
        (-g["piers"]["outer"]["x"][1], -g["piers"]["outer"]["x"][0], g["piers"]["outer"]["top"]),
        (-g["piers"]["inner"]["x"][1], -g["piers"]["inner"]["x"][0], g["piers"]["inner"]["top"]),
        (g["piers"]["inner"]["x"][0], g["piers"]["inner"]["x"][1], g["piers"]["inner"]["top"]),
        (g["piers"]["outer"]["x"][0], g["piers"]["outer"]["x"][1], g["piers"]["outer"]["top"]),
    ]
    for x0, x1, top_z in piers_spec:
        mb.add_box((x0 - 0.08, cy - hd - 0.08, 0.0), (x1 + 0.08, cy + hd + 0.08, g["piers"]["base_h"]), "mat_stone_granite_grey", skip=("-z",))
        mb.add_box((x0, cy - hd, g["piers"]["base_h"]), (x1, cy + hd, top_z), "mat_wall_ivory", skip=("-z",))
        for bz in g["piers"]["bands_z"]:
            if bz < top_z - 0.2:
                mb.add_box((x0 - 0.03, cy - hd - 0.03, bz), (x1 + 0.03, cy + hd + 0.03, bz + 0.07), "mat_trim_ochre")

    # Central bay entablature: beam, lower jade/ochre fretwork, raised plaque '學中南海', upper fretwork
    cb = g["central_bay"]
    ix0, ix1 = -g["piers"]["inner"]["x"][0], g["piers"]["inner"]["x"][0]
    mb.add_box((ix0, cy - hd * 0.82, cb["beam"][0]), (ix1, cy + hd * 0.82, cb["beam"][1]), "mat_wall_ivory")
    mb.add_box((ix0, cy - hd * 0.86, cb["fret_low"][0]), (ix1, cy + hd * 0.86, cb["fret_low"][1]), "mat_trim_jade")
    mb.add_box((ix0, cy - hd * 0.89, cb["fret_low"][0] - 0.05), (ix1, cy + hd * 0.89, cb["fret_low"][0] + 0.04), "mat_trim_ochre")
    mb.add_box((ix0, cy - hd * 0.89, cb["fret_low"][1] - 0.04), (ix1, cy + hd * 0.89, cb["fret_low"][1] + 0.05), "mat_trim_ochre")

    # Plaque backing + front & back calligraphic textured faces
    mb.add_box((ix0, cy - hd * 0.78, cb["plaque"][0] - 0.12), (ix1, cy + hd * 0.78, cb["plaque"][1] + 0.12), "mat_wall_ivory")
    px0, px1 = cb["plaque_x"]
    pz0, pz1 = cb["plaque"]
    # North face (+Y facing street) — UV oriented so 學中南海 reads cleanly from street looking south!
    yf = cy + hd * 0.81
    mb.add_quad(
        (px1, yf, pz0), (px0, yf, pz0), (px0, yf, pz1), (px1, yf, pz1),
        "mat_north_gate_plaque", explicit_uv=[(0, 0), (1, 0), (1, 1), (0, 1)]
    )
    # South face (-Y facing campus)
    yb = cy - hd * 0.81
    mb.add_quad(
        (px0, yb, pz0), (px1, yb, pz0), (px1, yb, pz1), (px0, yb, pz1),
        "mat_north_gate_plaque", explicit_uv=[(0, 0), (1, 0), (1, 1), (0, 1)]
    )
    # Upper fretwork band
    mb.add_box((ix0, cy - hd * 0.86, cb["fret_high"][0]), (ix1, cy + hd * 0.86, cb["fret_high"][1]), "mat_trim_jade")
    mb.add_box((ix0, cy - hd * 0.89, cb["fret_high"][1]), (ix1, cy + hd * 0.89, cb["fret_high"][1] + 0.08), "mat_trim_ochre")

    # Decorative corner brackets under central arch
    bw, bh = cb["bracket"]["w"], cb["bracket"]["h"]
    for sx in (-1, 1):
        bx = sx * (g["piers"]["inner"]["x"][0] - bw * 0.5)
        mb.add_box((bx - bw * 0.5, cy - hd * 0.55, cb["opening_top"] - bh), (bx + bw * 0.5, cy + hd * 0.55, cb["opening_top"]), "mat_trim_ochre")

    # Side bay entablatures & fretwork
    sb = g["side_bay"]
    for sign in (-1, 1):
        sx0 = sign * g["piers"]["inner"]["x"][1]
        sx1 = sign * g["piers"]["outer"]["x"][0]
        if sx0 > sx1:
            sx0, sx1 = sx1, sx0
        mb.add_box((sx0, cy - hd * 0.78, sb["opening_top"]), (sx1, cy + hd * 0.78, sb["fret_high"][1] + 0.12), "mat_wall_ivory")
        mb.add_box((sx0, cy - hd * 0.84, sb["fret_low"][0]), (sx1, cy + hd * 0.84, sb["fret_low"][1]), "mat_trim_jade")
        mb.add_box((sx0, cy - hd * 0.84, sb["fret_high"][0]), (sx1, cy + hd * 0.84, sb["fret_high"][1]), "mat_trim_jade")
        mb.add_box((sx0, cy - hd * 0.86, sb["opening_top"] - 0.05), (sx1, cy + hd * 0.86, sb["opening_top"] + 0.08), "mat_trim_ochre")

    # Three sweeping emerald-green glazed roofs with soaring corner eaves
    rc = g["roofs"]["central"]
    mb.add_curved_hip_roof(
        -rc["eave_x"] + 0.7, cy - rc["eave_y"] + 0.55,
        rc["eave_x"] - 0.7, cy + rc["eave_y"] - 0.55,
        z_eave=rc["eave_z"], pitch_deg=rc["pitch"], overhang=0.75,
        concave=0.22, upturn=rc["upturn"], tile_mat="mat_roof_emerald", trim_mat="mat_trim_white"
    )
    rs = g["roofs"]["side"]
    for sign in (-1, 1):
        rx0, rx1 = sign * rs["x_in"], sign * rs["x_out"]
        if rx0 > rx1:
            rx0, rx1 = rx1, rx0
        mb.add_curved_hip_roof(
            rx0 + 0.55, cy - rs["eave_y"] + 0.5,
            rx1 - 0.55, cy + rs["eave_y"] - 0.5,
            z_eave=rs["eave_z"], pitch_deg=rs["pitch"], overhang=0.62,
            concave=0.20, upturn=rs["upturn"], tile_mat="mat_roof_emerald", trim_mat="mat_trim_white"
        )

    # Four stone guardian lions
    ly = g["lions"]["y"]
    for lx in g["lions"]["x"]:
        _add_stone_lion(mb, lx, ly, 0.0, face_dir=1.0, lod=lod)

    # Flanking white campus walls with emerald-glazed tile coping
    wh = g["walls"]["h"]
    for side_key in ("west", "east"):
        pts = g["walls"][side_key]
        for a, b in zip(pts[:-1], pts[1:]):
            dx, dy = b[0] - a[0], b[1] - a[1]
            L = math.hypot(dx, dy)
            ang = math.atan2(dy, dx)
            xf = Matrix.Translation((a[0], a[1], 0.0)) @ Matrix.Rotation(ang, 4, "Z")
            mb.add_box((0.0, -0.22, 0.0), (L, 0.22, 0.45), "mat_stone_granite_grey", skip=("-z",), xform=xf)
            mb.add_box((0.0, -0.18, 0.45), (L, 0.18, wh), "mat_wall_ivory", skip=("-z",), xform=xf)
            mb.add_box((0.0, -0.34, wh), (L, 0.34, wh + 0.38), "mat_roof_emerald", xform=xf)

    # West gatehouse
    gh = g["gatehouse"]
    mb.add_box((gh["x"][0], gh["y"][0], 0.0), (gh["x"][1], gh["y"][1], gh["h"]), "mat_wall_ivory", skip=("-z",))
    mb.add_curved_hip_roof(
        gh["x"][0], gh["y"][0], gh["x"][1], gh["y"][1],
        z_eave=gh["h"], pitch_deg=26.0, overhang=0.55, concave=0.14, upturn=0.28,
        tile_mat="mat_roof_emerald", trim_mat="mat_trim_white"
    )

    return mb.finalize(
        "beimen_north_gate", coll,
        extras={
            "haiz_building_id": "beimen",
            "haiz_district": "d01_axis_forecourt",
            "haiz_tag": "photo-derived",
            "haiz_basis": g["basis"],
            "haiz_name": "北门牌坊（海南中學）",
        }
    )


def build_south_gate(spec: dict, mats: dict, coll: bpy.types.Collection, lod: int = 0) -> bpy.types.Object:
    """South Gate emerald-roofed paifang facing Gaodeng West Street (campus_nanmen.jpg)."""
    mb = MeshBuilder(mats)
    cx, cy = -66.0, -257.0
    hd = 0.65
    for x0, x1, top_z in [(-7.4, -5.8, 5.0), (-3.8, -2.4, 6.8), (2.4, 3.8, 6.8), (5.8, 7.4, 5.0)]:
        mb.add_box((cx + x0, cy - hd, 0.0), (cx + x1, cy + hd, 0.55), "mat_stone_granite_grey", skip=("-z",))
        mb.add_box((cx + x0, cy - hd, 0.55), (cx + x1, cy + hd, top_z), "mat_wall_ivory", skip=("-z",))
    # Central plaque beam
    mb.add_box((cx - 2.4, cy - 0.52, 4.3), (cx + 2.4, cy + 0.52, 6.6), "mat_wall_ivory")
    mb.add_quad(
        (cx - 2.0, cy - 0.55, 5.0), (cx + 2.0, cy - 0.55, 5.0), (cx + 2.0, cy - 0.55, 6.2), (cx - 2.0, cy - 0.55, 6.2),
        "mat_north_gate_plaque", explicit_uv=[(0, 0), (1, 0), (1, 1), (0, 1)]
    )
    mb.add_curved_hip_roof(
        cx - 4.4, cy - 1.1, cx + 4.4, cy + 1.1, z_eave=6.9, pitch_deg=32.0, overhang=0.7,
        concave=0.20, upturn=0.45, tile_mat="mat_roof_emerald", trim_mat="mat_trim_white"
    )
    for sign in (-1, 1):
        rx0, rx1 = cx + sign * 3.8, cx + sign * 7.8
        if rx0 > rx1:
            rx0, rx1 = rx1, rx0
        mb.add_box((rx0, cy - 0.5, 3.6), (rx1, cy + 0.5, 4.9), "mat_wall_ivory")
        mb.add_curved_hip_roof(
            rx0, cy - 0.9, rx1, cy + 0.9, z_eave=5.1, pitch_deg=30.0, overhang=0.55,
            concave=0.18, upturn=0.35, tile_mat="mat_roof_emerald", trim_mat="mat_trim_white"
        )
    return mb.finalize(
        "nanmen_south_gate", coll,
        extras={
            "haiz_building_id": "nanmen",
            "haiz_district": "d05_sports_living",
            "haiz_tag": "photo-derived/estimated",
            "haiz_basis": "campus_nanmen.jpg; emerald-glazed paifang gate opening onto Gaodeng West Street",
            "haiz_name": "南门牌坊",
        }
    )


def build_yihao(spec: dict, mats: dict, coll: bpy.types.Collection, lod: int = 0) -> bpy.types.Object:
    """
    Teaching Block 1 (一号教学楼 · 1923) — Hero Monumental 116m Lingnan-Modern Landmark.
    Calibrated from twin/data/buildings/yihao.json + jiaoxuelou-1600 + aerial_campus + scenery_13.
    """
    ys = spec["yihao_spec"]
    mb = MeshBuilder(mats)
    zf = ys["levels"]["ground_floor"]["above_road_m"]  # 1.05 m
    f1 = ys["levels"]["storeys"]["f1"]                 # 4.0 m
    fu = ys["levels"]["storeys"]["upper"]              # 3.39 m

    def lvl(s: int) -> float:
        return zf if s == 0 else zf + f1 + (s - 1) * fu

    # 1. Ground plinth & 3-riser red granite entrance steps (plaza 0.60 -> floor 1.05)
    mb.add_box((-57.2, -15.3, 0.55), (57.2, 0.2, zf), "mat_stone_granite_dark", skip=("-z",))
    for i in range(3):
        sz0 = 0.60 + i * 0.15
        sz1 = sz0 + 0.15
        sy = 5.6 + (3 - i) * 0.42
        mb.add_box((-10.5, 0.0, sz0), (10.5, sy, sz1), "mat_stone_granite_red", skip=("-z",))

    # 2. Central 7-storey Block (x = -12.1..12.1, y = -10.4..0.0)
    z_c7 = lvl(7)
    # Open through-hall on ground floor (x = -7.2..7.2) so visitor sees straight into courtyard!
    mb.add_box((-12.1, -10.4, zf), (-7.2, 0.0, lvl(1)), "mat_stone_granite_dark", skip=("-z",))
    mb.add_box((7.2, -10.4, zf), (12.1, 0.0, lvl(1)), "mat_stone_granite_dark", skip=("-z",))
    mb.add_box((-7.2, -10.4, lvl(1) - 0.35), (7.2, 0.0, lvl(1)), "mat_trim_white")
    # Polished courtyard hall columns inside through-hall
    for hx in (-3.6, 3.6):
        for hy in (-2.6, -7.8):
            mb.add_box((hx - 0.36, hy - 0.36, zf), (hx + 0.36, hy + 0.36, lvl(1) - 0.35), "mat_stone_granite_dark")

    # Central upper floors (storeys 2..7) front (+Y) and rear (-Y) with 3 grand bays
    bay_c = ys["parts"]["central"]["bay"]
    for s in range(1, 7):
        zs = lvl(s)
        sh = fu
        wh = 2.35 if s == 6 else 1.93
        sill = 0.75 if s == 6 else 0.90
        for bi, cx_bay in enumerate((-bay_c, 0.0, bay_c)):
            # Front facade (+Y)
            mb.add_recessed_window_bay(
                Vector((cx_bay, 0.0, zs)), Vector((1, 0, 0)), Vector((0, 1, 0)),
                bay_c, sh, 4.65, wh, sill_h=sill, wall_mat="mat_wall_ivory", mullions=3, lod=lod
            )
            # Rear facade (-Y)
            mb.add_recessed_window_bay(
                Vector((cx_bay, -10.4, zs)), Vector((-1, 0, 0)), Vector((0, -1, 0)),
                bay_c, sh, 4.4, wh, sill_h=sill, wall_mat="mat_wall_ivory", mullions=3, lod=lod
            )
        # Side return fills of central block
        mb.add_box((-12.1, -10.4, zs), (-10.6, 0.0, zs + sh), "mat_wall_ivory")
        mb.add_box((10.6, -10.4, zs), (12.1, 0.0, zs + sh), "mat_wall_ivory")

    # Central sweeping terracotta hip roof (signature red glazed tile!)
    mb.add_curved_hip_roof(
        -12.1, -10.4, 12.1, 0.0, z_eave=z_c7, pitch_deg=30.0, overhang=1.25,
        concave=0.14, upturn=0.55, tile_mat="mat_roof_terracotta", trim_mat="mat_trim_white"
    )

    # 3. Twin Dark-Granite Stair Towers (x = ±10.05..±16.5, y = -10.4..0.6)
    z_gtop = lvl(5) + 1.5
    z_t7 = lvl(7)
    for sign in (-1, 1):
        tx0, tx1 = sign * 10.05, sign * 16.5
        if tx0 > tx1:
            tx0, tx1 = tx1, tx0
        tcx = 0.5 * (tx0 + tx1)
        # Dark granite lower 5 storeys
        mb.add_box((tx0, -10.4, zf), (tx1, 0.6, z_gtop), "mat_stone_granite_dark", skip=("-z",))
        # Recessed stair tower windows on granite face
        for s in range(1, 5):
            zs = lvl(s) + 0.95
            mb.add_box((tcx - 0.95, 0.44, zs), (tcx + 0.95, 0.63, zs + 1.55), "mat_glass_classroom")
            if lod == 0:
                mb.add_box((tcx - 1.05, 0.58, zs - 0.08), (tcx + 1.05, 0.72, zs), "mat_stone_granite_dark")
        # Heavy protruding granite cornice at 5th storey
        mb.add_box((tx0 - 0.35, -10.6, z_gtop - 0.1), (tx1 + 0.35, 0.98, z_gtop + 0.72), "mat_stone_granite_dark")
        # Upper white plaster storeys (6-7) with arched 6th-storey window
        mb.add_box((tx0, -10.4, z_gtop + 0.72), (tx1, 0.52, z_t7 + 0.4), "mat_wall_ivory", skip=("-z",))
        # Arched window silhouette on tower front
        az0 = z_gtop + 1.15
        mb.add_box((tcx - 0.92, 0.36, az0), (tcx + 0.92, 0.56, az0 + 2.45), "mat_glass_turquoise")
        # Semicircular arch head above window
        for k in range(6):
            a0 = k * math.pi / 6.0
            a1 = (k + 1) * math.pi / 6.0
            mb.add_tri(
                (tcx, 0.56, az0 + 2.45),
                (tcx + 0.92 * math.cos(a0), 0.56, az0 + 2.45 + 0.92 * math.sin(a0)),
                (tcx + 0.92 * math.cos(a1), 0.56, az0 + 2.45 + 0.92 * math.sin(a1)),
                "mat_glass_turquoise"
            )
        # Crown parapet trim
        mb.add_box((tx0 - 0.22, -10.55, z_t7 + 0.4), (tx1 + 0.22, 0.74, z_t7 + 0.95), "mat_trim_white")

    # 4. Twin 6-Bay Wings (x = ±16.5..±48.0, y = -10.6..-0.3)
    z_w6 = lvl(6)
    z_col_top = lvl(2)
    wing_bay = 31.5 / 6.0  # 5.25 m
    for sign in (-1, 1):
        wx0, wx1 = sign * 16.5, sign * 48.0
        if wx0 > wx1:
            wx0, wx1 = wx1, wx0
        # Recessed lower 2-storey wall behind dark granite colonnade (scenery_13.jpg)
        for s in (0, 1):
            zs = lvl(s)
            sh = f1 if s == 0 else fu
            for bi in range(6):
                bx = wx0 + (bi + 0.5) * wing_bay
                mb.add_recessed_window_bay(
                    Vector((bx, -1.65, zs)), Vector((1, 0, 0)), Vector((0, 1, 0)),
                    wing_bay, sh, 3.35, sh * 0.62, sill_h=0.85, wall_mat="mat_wall_ivory", mullions=2, lod=lod
                )
                mb.add_recessed_window_bay(
                    Vector((bx, -10.6, zs)), Vector((-1, 0, 0)), Vector((0, -1, 0)),
                    wing_bay, sh, 3.35, sh * 0.60, sill_h=0.90, wall_mat="mat_wall_ivory", mullions=2, lod=lod
                )
        # Two-storey granite colonnade piers & heavy granite entablature
        for bi in range(7):
            px = wx0 + bi * wing_bay
            mb.add_box((px - 0.48, -0.95, zf), (px + 0.48, -0.15, z_col_top), "mat_stone_granite_dark", skip=("-z",))
        mb.add_box((wx0, -1.75, z_col_top - 0.35), (wx1, 0.05, z_col_top + 0.85), "mat_stone_granite_dark")

        # Upper 4 storeys (storeys 3..6) with crisp white pilasters & recessed classroom windows
        for s in range(2, 6):
            zs = lvl(s)
            for bi in range(6):
                bx = wx0 + (bi + 0.5) * wing_bay
                mb.add_recessed_window_bay(
                    Vector((bx, -0.3, zs)), Vector((1, 0, 0)), Vector((0, 1, 0)),
                    wing_bay, fu, 3.25, 2.0, sill_h=0.90, wall_mat="mat_wall_ivory", mullions=2, lod=lod
                )
                mb.add_recessed_window_bay(
                    Vector((bx, -10.6, zs)), Vector((-1, 0, 0)), Vector((0, -1, 0)),
                    wing_bay, fu, 3.25, 2.0, sill_h=0.90, wall_mat="mat_wall_ivory", mullions=2, lod=lod
                )
                if lod == 0:
                    # Subtle vertical pilaster strip between bays
                    px = wx0 + bi * wing_bay
                    mb.add_box((px - 0.36, -0.3, zs), (px + 0.36, -0.12, zs + fu), "mat_trim_white")
        # Wing terracotta roof
        mb.add_curved_hip_roof(
            wx0, -10.6, wx1, -0.3, z_eave=z_w6, pitch_deg=23.0, overhang=0.95,
            concave=0.06, upturn=0.18, tile_mat="mat_roof_terracotta", trim_mat="mat_trim_white"
        )

    # 5. Twin 7-Storey End Pavilions (x = ±48.0..±57.0, y = -15.1..0.0)
    z_p7 = lvl(7) - 1.2
    for sign in (-1, 1):
        px0, px1 = sign * 48.0, sign * 57.0
        if px0 > px1:
            px0, px1 = px1, px0
        pcx = 0.5 * (px0 + px1)
        mb.add_box((px0, -15.1, zf), (px1, 0.0, lvl(2)), "mat_stone_granite_dark", skip=("-z",))
        mb.add_box((px0, -15.1, lvl(2)), (px1, 0.0, z_p7), "mat_wall_ivory", skip=("-z",))
        for s in range(1, 6):
            zs = lvl(s) + 0.9
            mb.add_box((pcx - 1.5, -0.1, zs), (pcx + 1.5, 0.05, zs + 1.85), "mat_glass_classroom")
            mb.add_box((pcx - 1.5, -15.15, zs), (pcx + 1.5, -15.0, zs + 1.85), "mat_glass_classroom")
        mb.add_curved_hip_roof(
            px0, -15.1, px1, 0.0, z_eave=z_p7, pitch_deg=30.0, overhang=1.1,
            concave=0.12, upturn=0.48, tile_mat="mat_roof_terracotta", trim_mat="mat_trim_white"
        )

    # 6. Projecting Stepped Granite Portal 「1923」 & Sweeping Terracotta Canopy
    # Main portal piers (x = -4.4..-2.5 and 2.5..4.4, y = 3.8..5.6, z = zf..zf+8.0)
    z_ptop = zf + 8.0
    mb.add_box((-4.4, 3.8, zf), (-2.5, 5.6, z_ptop), "mat_stone_granite_dark", skip=("-z",))
    mb.add_box((2.5, 3.8, zf), (4.4, 5.6, z_ptop), "mat_stone_granite_dark", skip=("-z",))
    # Stepped corbelled arch shoulders (jiaoxuelou-1600.jpg)
    mb.add_box((-2.5, 3.8, zf + 5.2), (-1.9, 5.6, zf + 6.2), "mat_stone_granite_dark")
    mb.add_box((1.9, 3.8, zf + 5.2), (2.5, 5.6, zf + 6.2), "mat_stone_granite_dark")
    # Portal lintel + cornice
    mb.add_box((-4.55, 3.7, zf + 6.1), (4.55, 5.75, z_ptop), "mat_stone_granite_dark")
    mb.add_box((-4.85, 3.6, z_ptop), (4.85, 5.95, z_ptop + 0.35), "mat_stone_granite_dark")
    # 3D '1923' numerals on portal lintel front face
    _add_3d_numerals_1923(mb, 0.0, 5.75, zf + 6.65, h=0.76)

    # Upper canopy terrace columns (4 crisp white square piers supporting terracotta roof)
    for cx_col in (-4.4, 4.4):
        for cy_col in (1.2, 4.9):
            mb.add_box((cx_col - 0.42, cy_col - 0.42, z_ptop + 0.35), (cx_col + 0.42, cy_col + 0.42, zf + 10.6), "mat_trim_white")
    mb.add_curved_hip_roof(
        -5.0, 0.4, 5.0, 5.5, z_eave=zf + 10.6, pitch_deg=32.0, overhang=0.85,
        concave=0.18, upturn=0.45, tile_mat="mat_roof_terracotta", trim_mat="mat_trim_white"
    )

    # Flanking side porches with dark granite side portals & terracotta shed roofs
    for sign in (-1, 1):
        sx0, sx1 = sign * 4.5, sign * 10.05
        if sx0 > sx1:
            sx0, sx1 = sx1, sx0
        scx = 0.5 * (sx0 + sx1)
        mb.add_box((sx0, 3.2, zf), (scx - 1.2, 4.3, zf + 5.1), "mat_stone_granite_dark", skip=("-z",))
        mb.add_box((scx + 1.2, 3.2, zf), (sx1, 4.3, zf + 5.1), "mat_stone_granite_dark", skip=("-z",))
        mb.add_box((sx0, 3.1, zf + 4.1), (sx1, 4.4, zf + 5.2), "mat_stone_granite_dark")
        # White upper posts + red shed roof sloping down from facade (z=8.2 -> z=7.0)
        mb.add_box((scx - 1.9, 3.4, zf + 5.2), (scx - 1.4, 3.9, zf + 7.1), "mat_trim_white")
        mb.add_box((scx + 1.4, 3.4, zf + 5.2), (scx + 1.9, 3.9, zf + 7.1), "mat_trim_white")
        mb.add_quad((sx0 - 0.2, 4.5, zf + 6.95), (sx1 + 0.2, 4.5, zf + 6.95), (sx1 + 0.2, 0.0, zf + 8.35), (sx0 - 0.2, 0.0, zf + 8.35), "mat_roof_terracotta", uv_scale=0.38, ensure_dir=Vector((0, 0, 1)))
        mb.add_quad((sx0 - 0.2, 4.5, zf + 6.75), (sx1 + 0.2, 4.5, zf + 6.75), (sx1 + 0.2, 4.5, zf + 6.95), (sx0 - 0.2, 4.5, zf + 6.95), "mat_trim_white", ensure_dir=Vector((0, 1, 0)))

    return mb.finalize(
        "yihao_teaching_block_1", coll,
        extras={
            "haiz_building_id": "yihao",
            "haiz_district": "d01_axis_forecourt",
            "haiz_tag": "photo-derived/public-map",
            "haiz_basis": "OSM way 1165596682 + hero-2560/jiaoxuelou-1600/scenery_13/aerial_campus calibrated dimensions",
            "haiz_name": "一号教学楼（1923）",
        }
    )


def _add_sculpted_rock(mb: MeshBuilder, center: tuple[float, float, float], radii: tuple[float, float, float], seed: int, mat: str, detail: int = 2, carve_holes: bool = False):
    """Organic weathered limestone / Taihu scholar's rock with realistic stratified displacement."""
    tmp = bmesh.new()
    bmesh.ops.create_icosphere(tmp, subdivisions=detail, radius=1.0)
    rng = np.random.default_rng(seed)
    rx, ry, rz = radii
    cx, cy, cz = center
    # Random harmonic phases for naturalistic rock ledges and concavities
    freqs = rng.uniform(1.6, 4.8, (6, 3))
    phases = rng.uniform(0, 6.28, 6)
    amps = rng.uniform(0.08, 0.22, 6)

    for v in tmp.verts:
        p = v.co
        # Stratified horizontal limestone ribbing + multi-lobe crags
        disp = 1.0
        for f, ph, a in zip(freqs, phases, amps):
            disp += a * math.sin(p.x * f[0] + p.y * f[1] + p.z * f[2] + ph)
        # Flatten bottom so it seats solidly on plinth/ground
        z_scaled = p.z * rz * disp
        if p.z < -0.35:
            z_scaled = max(z_scaled, -rz * 0.55)
        x_scaled = p.x * rx * disp
        y_scaled = p.y * ry * disp
        if carve_holes:
            # Deep organic Taihu cavities / waist pinches matching campus_taihushi & jiaoxuelou-1600
            for hx, hz, hr in [(-1.8, 0.45, 0.65), (0.3, 0.1, 0.72), (1.75, 0.55, 0.58), (-0.6, -0.35, 0.55)]:
                d2 = ((x_scaled - hx) / hr) ** 2 + ((z_scaled - hz) / (hr * 0.85)) ** 2
                if d2 < 1.2:
                    pinch = math.exp(-d2 * 1.6)
                    y_scaled *= (1.0 - 0.78 * pinch)
                    z_scaled += 0.14 * pinch * math.sin(x_scaled * 1.4)
            # Eastward dragon-head cantilever peak (right side in jiaoxuelou-1600)
            if x_scaled > 1.2 and z_scaled > 0.0:
                x_scaled += 0.65 * (z_scaled / max(rz, 1.0))
        v.co = Vector((cx + x_scaled, cy + y_scaled, cz + z_scaled))

    center_v = Vector((cx, cy, cz))
    for f in tmp.faces:
        pts = [v.co.copy() for v in f.verts]
        out_dir = (sum(pts, Vector((0, 0, 0))) / len(pts)) - center_v
        if len(pts) == 3:
            mb.add_tri(pts[0], pts[1], pts[2], mat, uv_scale=0.35, ensure_dir=out_dir)
        elif len(pts) == 4:
            mb.add_quad(pts[0], pts[1], pts[2], pts[3], mat, uv_scale=0.35, ensure_dir=out_dir)
    tmp.free()


def build_taihu_and_forecourt(spec: dict, mats: dict, coll: bpy.types.Collection, lod: int = 0) -> bpy.types.Object:
    """
    Forecourt Ceremonial Taihu Stone 「虎踞龍盤捷報頻傳」, dark granite plinth,
    red granite central steps, grey side steps, clipped colonnade hedges, and flagpole.
    """
    fs = spec["forecourt_site"]
    th = fs["taihu"]
    mb = MeshBuilder(mats)

    # 1. Dark granite Taihu plinth (x = -4.0..3.5, y = 26.0..31.6, z = 0..0.75)
    px0, py0, px1, py1 = th["plinth"]
    pz = th["plinth_top"]
    mb.add_box((px0, py0, 0.0), (px1, py1, pz), "mat_stone_granite_dark", skip=("-z",))
    mb.add_box((px0 - 0.08, py0 - 0.08, pz - 0.10), (px1 + 0.08, py1 + 0.08, pz + 0.04), "mat_stone_granite_dark")
    # Emerald lawn bed crowning plinth
    mb.add_box((px0 + 0.22, py0 + 0.22, pz), (px1 - 0.22, py1 - 0.22, pz + 0.12), "mat_ground_lawn", skip=("-z",))
    # Front calligraphy slab 「虎踞龍盤捷報頻傳」 facing north (+Y)
    pan = th["panel"]
    mb.add_quad(
        (pan[1], py1 + 0.06, pan[2]), (pan[0], py1 + 0.06, pan[2]),
        (pan[0], py1 + 0.06, pan[3]), (pan[1], py1 + 0.06, pan[3]),
        "mat_taihu_plinth_panel", explicit_uv=[(0, 0), (1, 0), (1, 1), (0, 1)]
    )

    # 2. Multi-lobe Sculpted Taihu Scholar's Rock (7.5m x 2.9m x 3.1m above plinth)
    rcx = 0.5 * (px0 + px1)
    rcy = 0.5 * (py0 + py1)
    detail = 3 if lod == 0 else 2
    _add_sculpted_rock(mb, (rcx - 0.3, rcy, pz + 1.52), (3.45, 1.32, 1.55), 1923, "mat_stone_taihu", detail=detail, carve_holes=True)
    _add_sculpted_rock(mb, (rcx + 2.05, rcy - 0.15, pz + 1.38), (1.75, 1.05, 1.25), 1924, "mat_stone_taihu", detail=max(1, detail - 1), carve_holes=False)
    _add_sculpted_rock(mb, (rcx - 2.15, rcy + 0.10, pz + 1.15), (1.45, 0.95, 1.12), 1925, "mat_stone_taihu", detail=max(1, detail - 1), carve_holes=False)

    # 3. Four-riser Red Granite Central Steps flanking the Taihu plinth (y = 29.8)
    for rx0, rx1 in [(-12.5, -4.0), (3.5, 12.5)]:
        for i in range(4):
            sz0 = i * 0.15
            sz1 = sz0 + 0.15
            sy1 = 29.8 + (4 - i) * 0.40
            mb.add_box((rx0, 29.4, sz0), (rx1, sy1, sz1), "mat_stone_granite_red", skip=("-z",))

    # 4. Three-riser Grey Granite Side Plaza Steps (y = 20.5)
    for rx0, rx1 in [(-36.0, -14.5), (14.5, 52.0)]:
        for i in range(3):
            sz0 = 0.15 + i * 0.15
            sz1 = sz0 + 0.15
            sy1 = 20.5 + (3 - i) * 0.36
            mb.add_box((rx0, 20.1, sz0), (rx1, sy1, sz1), "mat_stone_granite_grey", skip=("-z",))

    # 5. Clipped Colonnade Hedges along Teaching Block 1 wings (scenery_13.jpg)
    for h in fs["hedges"]:
        hx0, hy0, hx1, hy1 = h["box"]
        mb.add_box((hx0, hy0, 0.60), (hx1, hy1, 0.60 + h["height"]), "mat_hedge", skip=("-z",))

    # 6. Ceremonial Flagpole on Stepped Granite Dais (north edge of central plaza)
    fx, fy = 0.0, 39.2
    mb.add_box((fx - 2.2, fy - 2.2, 0.0), (fx + 2.2, fy + 2.2, 0.25), "mat_stone_granite_grey", skip=("-z",))
    mb.add_box((fx - 1.5, fy - 1.5, 0.25), (fx + 1.5, fy + 1.5, 0.50), "mat_stone_granite_dark", skip=("-z",))
    mb.add_cylinder((fx, fy), 0.10, 0.045, 0.50, 15.8, "mat_metal_silver", segs=10)
    mb.add_cylinder((fx, fy), 0.13, 0.13, 15.75, 15.98, "mat_paint_gold", segs=10)
    # Ceremonial red banner gently waving in trade wind
    mb.add_quad((fx + 0.06, fy, 13.8), (fx + 2.2, fy - 0.25, 13.85), (fx + 2.2, fy - 0.18, 15.35), (fx + 0.06, fy, 15.3), "mat_paint_vermilion")
    mb.add_quad((fx + 2.2, fy - 0.25, 13.85), (fx + 0.06, fy, 13.8), (fx + 0.06, fy, 15.3), (fx + 2.2, fy - 0.18, 15.35), "mat_paint_vermilion")

    return mb.finalize(
        "forecourt_taihu_landmark", coll, smooth=True,
        extras={
            "haiz_building_id": "hujulongpan",
            "haiz_district": "d01_axis_forecourt",
            "haiz_tag": "photo-derived/estimated",
            "haiz_basis": th["basis"],
            "haiz_name": "太湖石「虎踞龍盤捷報頻傳」与前庭台阶",
        }
    )


def _loft_branch(mb: MeshBuilder, pts: list[list[float]], r0: float, r1: float, mat: str, segs: int = 8):
    """Smoothly loft a tapering organic tree limb along a 3D polyline ([x,y,z] or [x,y,z,r])."""
    if len(pts) < 2:
        return
    vecs = [Vector((p[0], p[1], p[2])) for p in pts]
    radii = [p[3] if len(p) >= 4 else (r0 * (1.0 - i / (len(pts) - 1)) + r1 * (i / (len(pts) - 1))) for i, p in enumerate(pts)]
    rings = []
    n = len(vecs)
    for i, p in enumerate(vecs):
        r = max(0.03, float(radii[i]))
        if i == 0:
            tang = (vecs[1] - vecs[0]).normalized()
        elif i == n - 1:
            tang = (vecs[-1] - vecs[-2]).normalized()
        else:
            tang = (vecs[i + 1] - vecs[i - 1]).normalized()
        if tang.length < 1e-6:
            tang = Vector((0, 0, 1))
        ref = Vector((0, 0, 1)) if abs(tang.z) < 0.92 else Vector((1, 0, 0))
        u = tang.cross(ref).normalized()
        v = tang.cross(u).normalized()
        ring = []
        for k in range(segs):
            a = k * 2.0 * math.pi / segs
            # Subtle organic bark fluting near trunk base
            flute = 1.0 + (0.14 * math.sin(a * 5.0 + i * 0.4) if (i < 2 and r > 0.35) else 0.0)
            ring.append(p + (u * math.cos(a) + v * math.sin(a)) * (r * flute))
        rings.append(ring)
    for i in range(n - 1):
        for k in range(segs):
            kn = (k + 1) % segs
            mb.add_quad(rings[i][k], rings[i][kn], rings[i + 1][kn], rings[i + 1][k], mat, uv_scale=0.6)
    mb.add_poly(rings[-1], mat)


def _add_leaf_cluster(mb: MeshBuilder, center: Vector, radius: float, seed: int, mat: str, lod: int = 0):
    """Layered tropical Terminalia rosette leaf cluster (broad horizontal pagoda discs)."""
    rng = np.random.default_rng(seed)
    n_discs = 5 if lod == 0 else 2
    for d in range(n_discs):
        ang = rng.uniform(0, 6.28)
        tilt = rng.uniform(-0.28, 0.28)
        off = Vector((rng.uniform(-0.55, 0.55) * radius, rng.uniform(-0.55, 0.55) * radius, rng.uniform(-0.22, 0.35) * radius))
        c = center + off
        r = radius * rng.uniform(0.55, 0.92)
        # 6-sided cupped rosette polygon catching sunlight naturally
        pts = []
        for k in range(6):
            a = ang + k * math.pi / 3.0
            ca, sa = math.cos(a), math.sin(a)
            pts.append(c + Vector((ca * r, sa * r, (sa * tilt - 0.14) * r)))
        apex = c + Vector((0, 0, r * 0.28))
        for k in range(6):
            mb.add_tri(apex, pts[k], pts[(k + 1) % 6], mat, uv_scale=0.5)


def build_centenary_terminalia(spec: dict, mats: dict, coll: bpy.types.Collection, lod: int = 0) -> bpy.types.Object:
    """
    Centenary Terminalia Tree (百年榄仁树, lanshu-1600.jpg + twin/data/trees.json).
    Uses the exact calibrated trunk, S-shaped low horizontal limb resting on the tall
    weathered boulder, secondary ascending boughs, planter bed, benches, and layered canopy.
    """
    L = spec["terminalia_hero"]
    mb = MeshBuilder(mats)
    tx, ty = L["trunk_xy"]
    zg = L["ground_z"]

    # 1. Calibrated limb skeleton from twin/data/trees.json
    segs = 9 if lod == 0 else 6
    canopy_anchors: list[tuple[Vector, float]] = []
    for limb in L["limbs"]:
        pts = limb["pts"]
        r0 = limb.get("r0", limb.get("r_base", 0.35))
        r1 = limb.get("r1", limb.get("r_tip", 0.14))
        _loft_branch(mb, pts, r0, r1, "mat_bark_tropical", segs=segs if r0 > 0.25 else max(5, segs - 2))
        # Harvest upper limb tips & mid-boughs for natural layered foliage placement
        if limb.get("id") != "trunk":
            for frac in (0.65, 0.85, 1.0):
                idx = min(len(pts) - 1, int(frac * (len(pts) - 1)))
                p = Vector((pts[idx][0], pts[idx][1], pts[idx][2]))
                if p.z > 3.2:
                    canopy_anchors.append((p, 2.6 if frac > 0.8 else 2.1))

    # Root flare buttresses seating into the planting bed
    for k in range(5):
        a = k * 2.0 * math.pi / 5.0 + 0.3
        _loft_branch(
            mb,
            [[tx + math.cos(a) * 0.32, ty + math.sin(a) * 0.32, zg + 0.85],
             [tx + math.cos(a) * 0.95, ty + math.sin(a) * 0.95, zg + 0.22],
             [tx + math.cos(a) * 1.45, ty + math.sin(a) * 1.45, zg - 0.05]],
            0.24, 0.10, "mat_bark_tropical", segs=6
        )

    # 2. Iconic Tall Supporting Boulder under the S-shaped low limb + companion stones (lanshu-1600.jpg)
    # Find lowest dip of L_low_limb_on_boulder
    low_limb = next((x for x in L["limbs"] if "low" in x.get("id", "")), None)
    if low_limb and len(low_limb["pts"]) > 10:
        dip = low_limb["pts"][10]
        bx, by, bz = dip[0], dip[1], dip[2]
    else:
        bx, by, bz = 48.0, 19.6, 2.7
    _add_sculpted_rock(mb, (bx, by, 0.60 + (bz - 0.60) * 0.48), (1.15, 0.88, (bz - 0.60) * 0.52), 881, "mat_stone_taihu", detail=2)
    _add_sculpted_rock(mb, (bx - 1.35, by - 0.45, 0.60 + 0.55), (0.85, 0.65, 0.62), 882, "mat_stone_taihu", detail=2)
    _add_sculpted_rock(mb, (bx - 3.6, by - 1.2, 0.60 + 0.38), (0.78, 0.52, 0.42), 883, "mat_stone_taihu", detail=1)

    # 3. Planting bed kerb & lush tropical groundcover around trunk
    bed_pts = next((z["geom"]["poly"] for z in spec["forecourt_site"]["zones"] if z["id"] == "lanren_bed"), None)
    if bed_pts:
        mb.add_poly([(p[0], p[1], 0.72) for p in bed_pts], "mat_ground_lawn", uv_scale=0.35)
        for a, b in zip(bed_pts, bed_pts[1:] + bed_pts[:1]):
            mb.add_quad((a[0], a[1], 0.58), (b[0], b[1], 0.58), (b[0], b[1], 0.76), (a[0], a[1], 0.76), "mat_stone_granite_grey")

    # 4. Rich Layered Terminalia Canopy (emerald green + subtle autumn crimson accents!)
    rng = np.random.default_rng(192308)
    # Fill calibrated envelope crown dome over all branches
    env = L.get("envelope", {}).get("poly", [])
    if env:
        ex = [p[0] for p in env]
        ey = [p[1] for p in env]
        ecx, ecy = 0.5 * (min(ex) + max(ex)), 0.5 * (min(ey) + max(ey))
        erx, ery = 0.44 * (max(ex) - min(ex)), 0.44 * (max(ey) - min(ey))
    else:
        ecx, ecy, erx, ery = tx + 3.0, ty - 1.0, 11.0, 9.5

    # Anchor foliage clusters along real limbs + pagoda crown tiers
    for idx, (pt, rad) in enumerate(canopy_anchors):
        mat_l = "mat_foliage_terminalia_autumn" if (idx % 8 == 0) else "mat_foliage_terminalia"
        _add_leaf_cluster(mb, pt + Vector((0, 0, 0.4)), rad, 2000 + idx, mat_l, lod=lod)

    n_crown = 54 if lod == 0 else 22
    for i in range(n_crown):
        a = rng.uniform(0, 6.283)
        r = math.sqrt(rng.uniform(0.05, 1.0))
        px = ecx + math.cos(a) * erx * r
        py = ecy + math.sin(a) * ery * r
        # Pagoda-dome crown height profile (higher near center, gracefully lower over east boulder)
        dome = math.sqrt(max(0.05, 1.0 - r * r * 0.85))
        pz = 5.2 + dome * 6.8 + rng.uniform(-0.8, 0.8)
        rad = rng.uniform(1.8, 3.1) * (0.85 + 0.3 * dome)
        mat_l = "mat_foliage_terminalia_autumn" if (rng.random() < 0.14) else "mat_foliage_terminalia"
        _add_leaf_cluster(mb, Vector((px, py, pz)), rad, 3000 + i, mat_l, lod=lod)

    return mb.finalize(
        "centenary_terminalia_hero", coll, smooth=True,
        extras={
            "haiz_building_id": "lanshu",
            "haiz_district": "d01_axis_forecourt",
            "haiz_tag": "photo-derived/estimated",
            "haiz_basis": L["basis"],
            "haiz_name": "百年榄仁树（镇校古树）",
        }
    )


def build_yanchi_and_arts(spec: dict, mats: dict, coll: bpy.types.Collection, lod: int = 0) -> tuple[bpy.types.Object, bpy.types.Object]:
    """
    District 03 Hero Pair:
      1) Yanchi Reflecting Ink-Pond (砚池): OSM basin, stratified shore rockery,
         crescent elevated cascade weir, vermilion '硯池' stele, lily pads, stepped deck.
      2) Art Education Center (艺术教育活动中心): Sweeping terracotta hipped entrance
         portico with white square piers facing Yanchi, stepped stairs + ramp, courtyard wings.
    """
    yc = spec["yanchi"]
    poly = yc["poly"]
    zg = 0.15
    zw = zg - yc["water_depth_below_ground"]  # -0.30 m
    mb_y = MeshBuilder(mats)

    # 1. Pond stone retaining wall (facing inward into basin) & bed
    for a, b in zip(poly, poly[1:] + poly[:1]):
        mb_y.add_quad((b[0], b[1], zw - 0.65), (a[0], a[1], zw - 0.65), (a[0], a[1], zg + 0.08), (b[0], b[1], zg + 0.08), "mat_stone_granite_dark")
        # Low coping curb along promenade top
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = max(1e-4, math.hypot(dx, dy))
        ox, oy = dy / L * 0.35, -dx / L * 0.35
        mb_y.add_quad((a[0], a[1], zg + 0.08), (b[0], b[1], zg + 0.08), (b[0] + ox, b[1] + oy, zg + 0.08), (a[0] + ox, a[1] + oy, zg + 0.08), "mat_stone_granite_grey", ensure_dir=Vector((0, 0, 1)))
    mb_y.add_poly([(p[0], p[1], zw - 0.65) for p in poly], "mat_stone_granite_dark")

    # 2. Reflective Ink-Green Water Surface
    mb_y.add_poly([(p[0], p[1], zw) for p in poly], "mat_water_yanchi", uv_scale=0.18)

    # 3. Lakeside Stratified Rockery & Raised Crescent Cascade Weir (wenhua_yanchi-800.jpg)
    detail = 2 if lod == 0 else 1
    for idx, rk in enumerate(yc["rockery"]):
        rx, ry = rk["xy"]
        sx, sy, sz = rk["size"]
        _add_sculpted_rock(mb_y, (rx, ry, zg + sz * 0.25), (sx * 0.58, sy * 0.58, sz * 0.55), 500 + idx, "mat_stone_taihu", detail=detail)

    # Shoreline accent boulders along the north-west and south edges
    rng = np.random.default_rng(1957)
    for i in range(len(poly)):
        a = Vector((poly[i][0], poly[i][1], 0))
        b = Vector((poly[(i + 1) % len(poly)][0], poly[(i + 1) % len(poly)][1], 0))
        L = (b - a).length
        steps = max(1, int(L / 4.2))
        for k in range(steps):
            pt = a.lerp(b, (k + 0.5) / steps)
            s = rng.uniform(0.55, 1.05)
            _add_sculpted_rock(mb_y, (pt.x, pt.y, zw + 0.25), (s * 0.85, s * 0.65, s * 0.45), 600 + i * 20 + k, "mat_stone_taihu", detail=1)

    # Raised Circular Cascade Basin & Falling Whitewater Sheet
    cb = yc["cascade"]
    cx, cy, cr, ch = cb["xy"][0], cb["xy"][1], cb["r"], cb["h"]
    mb_y.add_cylinder((cx, cy), cr, cr, zw - 0.2, zg + ch, "mat_stone_granite_dark", segs=18)
    mb_y.add_cylinder((cx, cy), cr - 0.14, cr - 0.14, zw, zg + ch - 0.04, "mat_water_yanchi", segs=18)
    # Cascading water curtain spilling east into main pond
    for k in range(7):
        a0 = -0.9 + k * 0.26
        a1 = a0 + 0.26
        r_out = cr + 0.08
        mb_y.add_quad(
            (cx + r_out * math.cos(a0), cy + r_out * math.sin(a0), zw),
            (cx + r_out * math.cos(a1), cy + r_out * math.sin(a1), zw),
            (cx + (r_out - 0.06) * math.cos(a1), cy + (r_out - 0.06) * math.sin(a1), zg + ch - 0.03),
            (cx + (r_out - 0.06) * math.cos(a0), cy + (r_out - 0.06) * math.sin(a0), zg + ch - 0.03),
            "mat_water_foam"
        )

    # 4. Upright Limestone Stele with Vermilion '硯池' Inscription facing NE toward promenade & pond (campus_yanchi.jpg)
    st = yc["stone"]
    sx, sy = st["xy"]
    sw, sd, sh = st["size"]
    ang = math.radians(-38.0)
    xf_st = Matrix.Translation((sx + 1.2, sy + 1.6, zg - 0.05)) @ Matrix.Rotation(ang, 4, "Z")
    # Tapered organic stone monolith with front textured inscription face
    mb_y.add_box((-sw * 0.5, -sd * 0.5, 0.0), (sw * 0.5, sd * 0.5, sh), "mat_stone_taihu", skip=("-z", "+y"), xform=xf_st)
    # Front inscribed face (+Y in stele local frame)
    mb_y.add_quad(
        xf_st @ Vector((sw * 0.5, sd * 0.5, 0.0)),
        xf_st @ Vector((-sw * 0.5, sd * 0.5, 0.0)),
        xf_st @ Vector((-sw * 0.44, sd * 0.46, sh)),
        xf_st @ Vector((sw * 0.44, sd * 0.46, sh)),
        "mat_yanchi_stele", explicit_uv=[(0, 0), (1, 0), (1, 1), (0, 1)]
    )
    # Lily pads scattered naturally on water
    for lx, ly, lr in [(44.2, -115.5, 0.36), (45.3, -116.2, 0.28), (47.8, -118.0, 0.34), (49.2, -114.6, 0.32), (52.5, -120.5, 0.38)]:
        mb_y.add_cylinder((lx, ly), lr, lr, zw + 0.01, zw + 0.03, "mat_foliage_banyan", segs=8)

    yanchi_obj = mb_y.finalize(
        "yanchi_ink_pond", coll, smooth=True,
        extras={
            "haiz_building_id": "yanchi",
            "haiz_district": "d03_yanchi_arts",
            "haiz_tag": "public-map/photo-derived",
            "haiz_basis": yc["basis"],
            "haiz_name": "砚池水景与朱红题石",
        }
    )

    # =====================================================================
    # Art Education Center (艺术教育活动中心, campus_yishu.jpg)
    # Strictly south-west of Yanchi (x=-14..44, y=-184..-131.5), ZERO overlap!
    # =====================================================================
    mb_a = MeshBuilder(mats)
    z0 = 0.15
    z_deck = 1.45

    # Entrance Portico directly facing Yanchi across stepped stone stairs (x=28..42, y=-142..-132.5)
    # Stepped granite entry staircase descending north toward Yanchi (y = -132.5 .. -129.8 -> stop at -130.6 clear of pond!)
    mb_a.add_box((27.5, -142.5, z0), (42.5, -132.5, z_deck), "mat_stone_granite_grey", skip=("-z",))
    for i in range(6):
        sz0 = z0 + i * 0.21
        sz1 = sz0 + 0.21
        sy = -132.5 + (6 - i) * 0.32
        mb_a.add_box((29.2, -132.8, sz0), (40.8, sy, sz1), "mat_stone_granite_grey", skip=("-z",))
    # Accessibility ramp along west side of portico (visible in campus_yishu.jpg!)
    mb_a.add_quad((23.0, -134.5, z0), (27.5, -134.5, z_deck), (27.5, -132.5, z_deck), (23.0, -132.5, z0), "mat_stone_granite_grey")
    # Tall crisp white square piers supporting the red hipped entrance portico
    for px in (29.2, 40.8):
        for py in (-133.4, -141.0):
            mb_a.add_box((px - 0.65, py - 0.65, z_deck), (px + 0.65, py + 0.65, z_deck + 5.8), "mat_trim_white")
    # Dark vertical wooden plaque on pier ('海南中学艺术教育中心')
    mb_a.add_box((40.45, -132.72, z_deck + 0.9), (41.15, -132.62, z_deck + 4.3), "mat_metal_dark")
    # Portico recessed glass entry wall behind piers
    mb_a.add_box((30.2, -141.6, z_deck), (39.8, -141.1, z_deck + 4.5), "mat_glass_classroom")
    # Sweeping Terracotta Glazed Hipped Portico Roof with white crest ridge (campus_yishu.jpg!)
    mb_a.add_curved_hip_roof(
        28.6, -141.8, 41.4, -132.8, z_eave=z_deck + 5.8, pitch_deg=32.0, overhang=1.15,
        concave=0.14, upturn=0.40, tile_mat="mat_roof_terracotta", trim_mat="mat_trim_white"
    )

    # Courtyard Red-Tiled Wings of the Art Education Center (North, West, East, South wings enclosing twin courts)
    wings = [
        # (x0, y0, x1, y1, height)
        (-13.5, -146.5, 28.5, -134.5, 11.4),   # North-west gallery wing
        (-13.5, -183.5, -2.5, -146.5, 11.4),   # West performance wing
        (31.0, -183.5, 43.0, -142.0, 11.4),    # East studio wing
        (-13.5, -183.5, 43.0, -172.0, 11.4),   # South auditorium wing
        (8.0, -172.0, 18.0, -146.5, 8.6),      # Inner low divider hall
    ]
    for wx0, wy0, wx1, wy1, wh in wings:
        mb_a.add_box((wx0, wy0, z0), (wx1, wy1, z0 + wh), "mat_wall_ivory", skip=("-z",))
        # Recessed windows along exterior faces
        n_x = max(2, int((wx1 - wx0) / 5.2))
        for fl in range(3):
            zw_f = z0 + 1.1 + fl * 3.4
            if zw_f + 1.8 > z0 + wh - 0.6:
                continue
            for bi in range(n_x):
                bx = wx0 + (bi + 0.5) * ((wx1 - wx0) / n_x)
                mb_a.add_box((bx - 1.2, wy1 - 0.05, zw_f), (bx + 1.2, wy1 + 0.08, zw_f + 1.8), "mat_glass_classroom")
                mb_a.add_box((bx - 1.2, wy0 - 0.08, zw_f), (bx + 1.2, wy0 + 0.05, zw_f + 1.8), "mat_glass_classroom")
        if wh > 9.5:
            mb_a.add_curved_hip_roof(
                wx0, wy0, wx1, wy1, z_eave=z0 + wh, pitch_deg=25.0, overhang=0.95,
                concave=0.08, upturn=0.30, tile_mat="mat_roof_terracotta", trim_mat="mat_trim_white"
            )
        else:
            mb_a.add_box((wx0, wy0, z0 + wh), (wx1, wy1, z0 + wh + 0.45), "mat_roof_flat")

    arts_obj = mb_a.finalize(
        "arts_education_center", coll,
        extras={
            "haiz_building_id": "arts",
            "haiz_district": "d03_yanchi_arts",
            "haiz_tag": "photo-derived/public-map",
            "haiz_basis": "campus_yishu.jpg + Esri orthophoto; red-tiled portico facing Yanchi, stepped stairs, ramp & courtyard wings",
            "haiz_name": "艺术教育活动中心",
        }
    )
    return yanchi_obj, arts_obj


def build_library(spec: dict, mats: dict, coll: bpy.types.Collection, lod: int = 0) -> bpy.types.Object:
    """
    Hainan Middle School Library & Astronomical Observatory (图书馆与天文台, campus_library.jpg).
    Sculptural 4-storey white modernist massing, sweeping external grand staircase,
    tall arched turquoise glass curtain wall, corner cylindrical glass stair tower,
    and ribbed metallic astronomical observatory dome crowning the roof!
    """
    b = next(x for x in spec["buildings"] if x["id"] == "library")
    x0, y0, x1, y1 = b["bbox"]
    cx, cy = 0.5 * (x0 + x1), 0.5 * (y0 + y1)
    mb = MeshBuilder(mats)
    z0 = 0.15
    sh = 3.85
    floors = 4
    z_top = z0 + floors * sh

    # 1. Main stepped 4-storey white modernist volume (recessed gallery bands + crisp floor plates)
    mx0, my0, mx1, my1 = x0 + 4.5, y0 + 2.0, x1 - 1.5, y1 - 2.0
    mb.add_box((mx0, my0, z0), (mx1, my1, z_top), "mat_wall_ivory", skip=("-z",))

    # Deep horizontal cantilevered reading balcony ribbons & recessed glass walls on all 4 floors
    for fl in range(floors):
        zf = z0 + fl * sh
        # Projecting white balcony slab & parapet
        out = 1.45 if fl > 0 else 0.4
        mb.add_box((mx0 - out, my0 - out, zf), (mx1 + out, my1 + out, zf + 0.34), "mat_trim_white")
        if fl > 0:
            mb.add_box((mx0 - out, my0 - out, zf + 0.34), (mx1 + out, my1 + out, zf + 1.05), "mat_wall_ivory")
        # Recessed continuous horizontal window ribbons along west (-X facing campus) and north (+Y)
        for by in np.linspace(my0 + 3.0, my1 - 3.0, 6):
            mb.add_box((mx0 - 0.15, by - 2.1, zf + 1.05), (mx0 + 0.12, by + 2.1, zf + sh - 0.25), "mat_glass_classroom")
            mb.add_box((mx1 - 0.12, by - 2.1, zf + 1.05), (mx1 + 0.15, by + 2.1, zf + sh - 0.25), "mat_glass_classroom")
        for bx in np.linspace(mx0 + 3.5, mx1 - 3.5, 5):
            mb.add_box((bx - 2.2, my1 - 0.12, zf + 1.05), (bx + 2.2, my1 + 0.15, zf + sh - 0.25), "mat_glass_classroom")
            mb.add_box((bx - 2.2, my0 - 0.15, zf + 1.05), (bx + 2.2, my0 + 0.12, zf + sh - 0.25), "mat_glass_classroom")
        # Structural vertical white frame fins between bays
        for by in np.linspace(my0 + 0.5, my1 - 0.5, 7):
            mb.add_box((mx0 - out, by - 0.26, zf), (mx0, by + 0.26, zf + sh), "mat_trim_white")

    # 2. Iconic Tall Arched Turquoise-Blue Glass Atrium Vault with aluminum mullions (campus_library.jpg!)
    ax_c = mx0 + 3.0
    ay_c = cy + 6.5
    arch_r = 3.9
    arch_z0 = z0 + sh * 2.0
    arch_z1 = z_top + 1.2
    mb.add_box((mx0 - 1.6, ay_c - arch_r - 0.45, arch_z0), (mx0 + 5.5, ay_c + arch_r + 0.45, arch_z1), "mat_trim_white")
    mb.add_box((mx0 - 1.72, ay_c - arch_r + 0.2, arch_z0), (mx0 - 1.45, ay_c + arch_r - 0.2, arch_z1), "mat_glass_turquoise")
    # Crisp vertical & horizontal curtain-wall mullions on turquoise arch
    for my_m in np.linspace(ay_c - arch_r + 1.1, ay_c + arch_r - 1.1, 5):
        mb.add_box((mx0 - 1.78, my_m - 0.05, arch_z0), (mx0 - 1.68, my_m + 0.05, arch_z1 + arch_r * 0.78), "mat_metal_silver")
    for mz_m in np.linspace(arch_z0 + 1.6, arch_z1 + 1.8, 5):
        mb.add_box((mx0 - 1.78, ay_c - arch_r + 0.3, mz_m - 0.05), (mx0 - 1.68, ay_c + arch_r - 0.3, mz_m + 0.05), "mat_metal_silver")
    # Vaulted arched crown rising above parapet
    segs = 12
    for k in range(segs):
        a0 = k * math.pi / segs
        a1 = (k + 1) * math.pi / segs
        y_a0 = ay_c + arch_r * math.cos(a0)
        z_a0 = arch_z1 + arch_r * math.sin(a0)
        y_a1 = ay_c + arch_r * math.cos(a1)
        z_a1 = arch_z1 + arch_r * math.sin(a1)
        out_arch = Vector((0, math.cos(0.5 * (a0 + a1)), math.sin(0.5 * (a0 + a1))))
        # Barrel vault shell
        mb.add_quad((mx0 - 1.65, y_a0, z_a0), (mx0 - 1.65, y_a1, z_a1), (mx0 + 6.5, y_a1, z_a1), (mx0 + 6.5, y_a0, z_a0), "mat_trim_white", ensure_dir=out_arch)
        # Turquoise glass arch fill facing west (-X)
        mb.add_tri((mx0 - 1.68, ay_c, arch_z1), (mx0 - 1.68, y_a1, z_a1), (mx0 - 1.68, y_a0, z_a0), "mat_glass_turquoise", ensure_dir=Vector((-1, 0, 0)))

    # 3. Sweeping External Grand Ceremonial Staircase (descending west from 2nd-floor lobby to plaza!)
    st_y0, st_y1 = cy - 4.0, cy + 4.0
    n_steps = 16 if lod == 0 else 6
    x_bot = x0 - 4.8
    x_top = mx0 - 1.4
    for i in range(n_steps):
        t0 = i / n_steps
        t1 = (i + 1) / n_steps
        sx0 = x_bot + (x_top - x_bot) * t0
        sx1 = x_bot + (x_top - x_bot) * t1
        sz = z0 + (sh * 1.0) * t1
        mb.add_box((sx0, st_y0 + 0.5, z0), (sx1 + 0.1, st_y1 - 0.5, sz), "mat_stone_granite_grey", skip=("-z",))
    # Iconic white tiled stepped cheek walls & silver handrails flanking the grand stairs
    for sy_side in (st_y0, st_y1 - 0.55):
        mb.add_quad((x_bot, sy_side, z0), (x_top, sy_side, z0), (x_top, sy_side, z0 + sh + 1.15), (x_bot, sy_side, z0 + 1.15), "mat_wall_pale_tile")
        mb.add_quad((x_top, sy_side + 0.55, z0), (x_bot, sy_side + 0.55, z0), (x_bot, sy_side + 0.55, z0 + 1.15), (x_top, sy_side + 0.55, z0 + sh + 1.15), "mat_wall_pale_tile")
        mb.add_quad((x_bot, sy_side, z0 + 1.15), (x_top, sy_side, z0 + sh + 1.15), (x_top, sy_side + 0.55, z0 + sh + 1.15), (x_bot, sy_side + 0.55, z0 + 1.15), "mat_metal_silver")
    # Sweeping cantilevered entry canopy over 2nd-floor landing
    mb.add_box((x_top - 4.2, st_y0 - 0.8, z0 + sh + 3.1), (mx0, st_y1 + 0.8, z0 + sh + 3.55), "mat_trim_white")

    # 4. Corner Cylindrical Turquoise Glass Stair Shaft (SW corner, campus_library.jpg!)
    mb.add_cylinder((mx0 - 0.4, my0 - 0.2), 2.4, 2.4, z0, z_top + 0.6, "mat_glass_turquoise", segs=12)

    # 5. Unmistakable Ribbed Silver Astronomical Observatory Dome (天文台穹顶!)
    dx, dy = mx0 + 9.5, cy - 8.5
    drum_r = 4.6
    drum_z0 = z_top
    drum_z1 = z_top + 2.4
    # Glazed observatory drum
    mb.add_cylinder((dx, dy), drum_r, drum_r, drum_z0, drum_z0 + 1.2, "mat_wall_ivory", segs=16)
    mb.add_cylinder((dx, dy), drum_r - 0.1, drum_r - 0.1, drum_z0 + 1.2, drum_z1, "mat_glass_turquoise", segs=16)
    mb.add_cylinder((dx, dy), drum_r + 0.25, drum_r + 0.25, drum_z1, drum_z1 + 0.35, "mat_trim_white", segs=16)
    # Ribbed hemispherical metallic dome
    dome_z = drum_z1 + 0.35
    dome_r = drum_r - 0.15
    u_segs = 16 if lod == 0 else 10
    v_segs = 7 if lod == 0 else 4
    for j in range(v_segs):
        phi0 = (j / v_segs) * (math.pi * 0.5)
        phi1 = ((j + 1) / v_segs) * (math.pi * 0.5)
        r0, h0 = dome_r * math.cos(phi0), dome_r * math.sin(phi0)
        r1, h1 = dome_r * math.cos(phi1), dome_r * math.sin(phi1)
        for i in range(u_segs):
            a0 = i * 2.0 * math.pi / u_segs
            a1 = (i + 1) * 2.0 * math.pi / u_segs
            # Slight alternating radial fluting for crisp observatory dome ribs!
            rib0 = 1.02 if (i % 2 == 0) else 0.985
            rib1 = 1.02 if ((i + 1) % 2 == 0) else 0.985
            p00 = (dx + r0 * rib0 * math.cos(a0), dy + r0 * rib0 * math.sin(a0), dome_z + h0)
            p10 = (dx + r0 * rib1 * math.cos(a1), dy + r0 * rib1 * math.sin(a1), dome_z + h0)
            p11 = (dx + r1 * rib1 * math.cos(a1), dy + r1 * rib1 * math.sin(a1), dome_z + h1)
            p01 = (dx + r1 * rib0 * math.cos(a0), dy + r1 * rib0 * math.sin(a0), dome_z + h1)
            out_v = Vector((math.cos(0.5 * (a0 + a1)) * math.cos(0.5 * (phi0 + phi1)), math.sin(0.5 * (a0 + a1)) * math.cos(0.5 * (phi0 + phi1)), math.sin(0.5 * (phi0 + phi1))))
            if j == v_segs - 1:
                mb.add_tri(p00, p10, (dx, dy, dome_z + dome_r), "mat_metal_silver", ensure_dir=out_v)
            else:
                mb.add_quad(p00, p10, p11, p01, "mat_metal_silver", ensure_dir=out_v)
    # Raised double-shutter telescope observation slit crest
    mb.add_box((dx - 0.55, dy - dome_r * 0.85, dome_z + dome_r * 0.55), (dx + 0.55, dy + dome_r * 0.85, dome_z + dome_r + 0.25), "mat_metal_dark")

    # Roof parapet
    mb.add_box((mx0, my0, z_top), (mx1, my1, z_top + 0.4), "mat_roof_flat")

    return mb.finalize(
        "library_observatory_hero", coll,
        extras={
            "haiz_building_id": "library",
            "haiz_district": "d04_heritage_gardens",
            "haiz_tag": "photo-derived/estimated",
            "haiz_basis": b["basis"],
            "haiz_name": "图书馆与天文台",
        }
    )


def build_lingnan_green_hall(b: dict, mats: dict, coll: bpy.types.Collection, lod: int = 0) -> bpy.types.Object:
    """
    Single-storey emerald-green glazed tiled Lingnan heritage hall (凤栖堂 / 衍林堂,
    campus_fengqitang.jpg): raised stone plinth, vermilion colonnade, white plaster walls,
    red wooden doors/windows, curved emerald glazed hip roof, and bronze statue in front!
    """
    mb = MeshBuilder(mats)
    x0, y0, x1, y1 = b["bbox"]
    cx, cy = 0.5 * (x0 + x1), 0.5 * (y0 + y1)
    W = x1 - x0
    D = y1 - y0
    z0 = 0.15
    z_plinth = z0 + 0.55
    z_eave = z_plinth + 4.2

    # Stepped granite plinth
    mb.add_box((x0, y0, z0), (x1, y1, z_plinth), "mat_stone_granite_grey", skip=("-z",))
    # Front steps facing south (-Y)
    mb.add_box((cx - 4.5, y0 - 0.9, z0), (cx + 4.5, y0, z0 + 0.28), "mat_stone_granite_red", skip=("-z",))
    # Inner whitewashed hall walls recessed behind veranda colonnade
    mb.add_box((x0 + 1.8, y0 + 1.8, z_plinth), (x1 - 1.8, y1 - 1.6, z_eave), "mat_wall_ivory", skip=("-z",))
    # Traditional vermilion doors & lattice windows along front wall
    for wx in np.linspace(x0 + 4.2, x1 - 4.2, 5):
        mb.add_box((wx - 0.85, y0 + 1.68, z_plinth + 0.1), (wx + 0.85, y0 + 1.85, z_plinth + 2.85), "mat_paint_vermilion")
        mb.add_box((wx - 0.65, y0 + 1.64, z_plinth + 1.1), (wx + 0.65, y0 + 1.72, z_plinth + 2.55), "mat_glass_classroom")

    # Perimeter colonnade of vermilion cylindrical columns + wood lintel beam
    n_cols = max(5, int(round(W / 3.8)))
    for px in np.linspace(x0 + 0.8, x1 - 0.8, n_cols):
        for py in (y0 + 0.8, y1 - 0.8):
            mb.add_cylinder((px, py), 0.24, 0.20, z_plinth, z_plinth + 0.28, "mat_stone_granite_grey", segs=8)
            mb.add_cylinder((px, py), 0.17, 0.15, z_plinth + 0.28, z_eave, "mat_paint_vermilion", segs=10)
    # Red tie beams & carved lintels
    mb.add_box((x0 + 0.6, y0 + 0.6, z_eave - 0.45), (x1 - 0.6, y0 + 1.0, z_eave), "mat_paint_vermilion")
    mb.add_box((x0 + 0.6, y1 - 1.0, z_eave - 0.45), (x1 - 0.6, y1 - 0.6, z_eave), "mat_paint_vermilion")

    # Sweeping Emerald Glazed Curved Hip Roof
    mb.add_curved_hip_roof(
        x0 + 0.3, y0 + 0.3, x1 - 0.3, y1 - 0.3, z_eave=z_eave, pitch_deg=30.0, overhang=1.25,
        concave=0.18, upturn=0.48, tile_mat="mat_roof_emerald", trim_mat="mat_trim_white"
    )

    # Scholar bronze statue on granite pedestal in front forecourt (campus_fengqitang.jpg)
    _add_bronze_statue(mb, cx, y0 - 5.2, z0)

    return mb.finalize(
        f"{b['id']}_heritage_hall", coll,
        extras={
            "haiz_building_id": b["id"],
            "haiz_district": b["district"],
            "haiz_tag": b["tag"],
            "haiz_basis": b["basis"],
            "haiz_name": b["name"],
        }
    )


def build_pavilion(b: dict, mats: dict, coll: bpy.types.Collection, lod: int = 0) -> bpy.types.Object:
    """Square emerald-roofed garden pavilion (凤栖亭 / 衍林亭, campus_yanlintang.jpg)."""
    mb = MeshBuilder(mats)
    cx, cy = b["center"]
    z0 = 0.15
    zp = z0 + 0.45
    hs = 2.65
    ze = zp + 3.15

    # Two-step square granite podium
    mb.add_box((cx - hs - 0.65, cy - hs - 0.65, z0), (cx + hs + 0.65, cy + hs + 0.65, z0 + 0.22), "mat_stone_granite_grey", skip=("-z",))
    mb.add_box((cx - hs - 0.35, cy - hs - 0.35, z0 + 0.22), (cx + hs + 0.35, cy + hs + 0.35, zp), "mat_stone_granite_grey", skip=("-z",))

    # Four vermilion columns on carved pale stone drum bases
    for sx in (-1, 1):
        for sy in (-1, 1):
            px, py = cx + sx * (hs - 0.35), cy + sy * (hs - 0.35)
            mb.add_cylinder((px, py), 0.30, 0.22, zp, zp + 0.30, "mat_stone_granite_grey", segs=10)
            mb.add_cylinder((px, py), 0.16, 0.15, zp + 0.30, ze, "mat_paint_vermilion", segs=10)

    # Wrap-around 美人靠 bench railings (open on south entrance)
    for x0, y0, x1, y1 in [
        (cx - hs + 0.2, cy + hs - 0.45, cx + hs - 0.2, cy + hs - 0.05),
        (cx - hs + 0.05, cy - hs + 0.4, cx - hs + 0.45, cy + hs - 0.4),
        (cx + hs - 0.45, cy - hs + 0.4, cx + hs - 0.05, cy + hs - 0.4),
    ]:
        mb.add_box((x0, y0, zp + 0.42), (x1, y1, zp + 0.54), "mat_paint_vermilion")
        mb.add_box((x0, y0, zp + 0.92), (x1, y1, zp + 1.02), "mat_paint_vermilion")

    # Beams & sweeping pyramidal emerald glazed roof with lotus spire
    mb.add_box((cx - hs, cy - hs, ze - 0.35), (cx + hs, cy + hs, ze), "mat_paint_vermilion")
    mb.add_pavilion_roof(cx, cy, hs + 0.95, z_eave=ze, rise=2.35, upturn=0.58)

    return mb.finalize(
        f"{b['id']}_pavilion", coll,
        extras={
            "haiz_building_id": b["id"],
            "haiz_district": b["district"],
            "haiz_tag": b["tag"],
            "haiz_basis": b["basis"],
            "haiz_name": b["name"],
        }
    )


def build_alumni_hall(b: dict, mats: dict, coll: bpy.types.Collection, lod: int = 0) -> bpy.types.Object:
    """Two-storey emerald-roofed Alumni Association Hall (校友会馆, campus_xiaoyouhui.jpg)."""
    mb = MeshBuilder(mats)
    x0, y0, x1, y1 = b["bbox"]
    cx, cy = 0.5 * (x0 + x1), 0.5 * (y0 + y1)
    z0 = 0.15
    z1 = z0 + 3.6
    z2 = z1 + 3.5

    # Ground floor recessed portico + vermilion columns & lattice door
    mb.add_box((x0, y0, z0), (x1, y1, z0 + 0.45), "mat_stone_granite_grey", skip=("-z",))
    mb.add_box((x0 + 1.5, y0 + 1.5, z0 + 0.45), (x1 - 1.5, y1 - 1.0, z1), "mat_wall_ivory", skip=("-z",))
    for px in np.linspace(x0 + 0.8, x1 - 0.8, 5):
        mb.add_box((px - 0.22, y0 + 0.4, z0 + 0.45), (px + 0.22, y0 + 0.84, z1), "mat_paint_vermilion")
    mb.add_box((cx - 2.6, y0 + 1.4, z0 + 0.45), (cx + 2.6, y0 + 1.58, z0 + 3.0), "mat_paint_vermilion")

    # First-tier emerald glazed skirt eaves around perimeter
    mb.add_curved_hip_roof(x0 + 0.2, y0 + 0.2, x1 - 0.2, y1 - 0.2, z_eave=z1, pitch_deg=26.0, overhang=1.1, concave=0.14, upturn=0.35, tile_mat="mat_roof_emerald")

    # Second storey set back with vermilion balcony balustrade & lattice window
    mb.add_box((x0 + 2.0, y0 + 2.4, z1 + 0.3), (x1 - 2.0, y1 - 1.8, z2), "mat_wall_ivory", skip=("-z",))
    mb.add_box((cx - 3.4, y0 + 2.28, z1 + 1.0), (cx + 3.4, y0 + 2.46, z2 - 0.6), "mat_paint_vermilion")
    mb.add_box((cx - 3.1, y0 + 2.25, z1 + 1.2), (cx + 3.1, y0 + 2.32, z2 - 0.8), "mat_glass_classroom")
    mb.add_box((x0 + 0.8, y0 + 0.6, z1 + 1.0), (x1 - 0.8, y0 + 0.8, z1 + 2.05), "mat_paint_vermilion")

    # Upper sweeping emerald glazed roof
    mb.add_curved_hip_roof(x0 + 1.8, y0 + 2.2, x1 - 1.8, y1 - 1.6, z_eave=z2, pitch_deg=30.0, overhang=1.15, concave=0.18, upturn=0.45, tile_mat="mat_roof_emerald")

    # Front founder bronze statue
    _add_bronze_statue(mb, cx, y0 - 4.2, z0)

    return mb.finalize(
        "xiaoyouhui_alumni_hall", coll,
        extras={
            "haiz_building_id": b["id"],
            "haiz_district": b["district"],
            "haiz_tag": b["tag"],
            "haiz_basis": b["basis"],
            "haiz_name": b["name"],
        }
    )


def build_keji(b: dict, mats: dict, coll: bpy.types.Collection, lod: int = 0) -> bpy.types.Object:
    """Science & Technology Building (科技楼, campus_keji.jpg): white/warm-sand vertical fins + bronze double-height glass lobby."""
    mb = MeshBuilder(mats)
    x0, y0, x1, y1 = b["bbox"]
    cx = 0.5 * (x0 + x1)
    z0 = 0.15
    floors = 5
    sh = 3.7
    z_top = z0 + floors * sh

    mb.add_box((x0, y0, z0), (x1, y1, z_top), "mat_wall_ivory", skip=("-z",))
    # Double-height recessed dark bronze-framed glass lobby centered on south facade (-Y)
    mb.add_box((cx - 10.5, y0 - 0.12, z0), (cx + 10.5, y0 + 0.4, z0 + sh * 2.0 - 0.2), "mat_glass_classroom")
    for mx in np.linspace(cx - 10.2, cx + 10.2, 9):
        mb.add_box((mx - 0.08, y0 - 0.18, z0), (mx + 0.08, y0 + 0.02, z0 + sh * 2.0 - 0.2), "mat_metal_dark")
    mb.add_box((cx - 10.7, y0 - 0.25, z0 + sh * 2.0 - 0.35), (cx + 10.7, y0 + 0.1, z0 + sh * 2.0), "mat_metal_dark")

    # Alternating vertical white & warm-sand architectural fins with recessed window ribbons
    nb = 14
    bw = (x1 - x0) / nb
    for i in range(nb):
        bx = x0 + (i + 0.5) * bw
        in_lobby = abs(bx - cx) < 10.6
        for fl in range(floors):
            if in_lobby and fl < 2:
                continue
            zf = z0 + fl * sh
            mb.add_box((bx - bw * 0.32, y0 - 0.06, zf + 0.85), (bx + bw * 0.32, y0 + 0.06, zf + sh - 0.45), "mat_glass_classroom")
            mb.add_box((bx - bw * 0.32, y1 - 0.06, zf + 0.85), (bx + bw * 0.32, y1 + 0.06, zf + sh - 0.45), "mat_glass_classroom")
        if lod == 0:
            fx = x0 + i * bw
            fmat = "mat_wall_warm_sand" if (i % 2 == 1) else "mat_trim_white"
            mb.add_box((fx - 0.28, y0 - 0.35, z0 + (sh * 2.0 if in_lobby else 0.0)), (fx + 0.28, y0 + 0.05, z_top), fmat)

    mb.add_box((x0 - 0.3, y0 - 0.3, z_top), (x1 + 0.3, y1 + 0.3, z_top + 0.9), "mat_trim_white")
    mb.add_box((x0 + 0.3, y0 + 0.3, z_top + 0.1), (x1 - 0.3, y1 - 0.3, z_top + 0.35), "mat_roof_flat")

    return mb.finalize(
        "keji_tech_building", coll,
        extras={
            "haiz_building_id": b["id"],
            "haiz_district": b["district"],
            "haiz_tag": b["tag"],
            "haiz_basis": b["basis"],
            "haiz_name": b["name"],
        }
    )


def build_stadium_grandstand(b: dict, mats: dict, coll: bpy.types.Collection, lod: int = 0) -> bpy.types.Object:
    """Stepped concrete bleachers & cantilevered metal canopy overlooking the 400m track (campus_playground.jpg)."""
    mb = MeshBuilder(mats)
    x0, y0, x1, y1 = b["bbox"]
    z0 = 0.15
    # Stepped seating tiers rising south-to-north-facing (facing +Y toward track)
    n_tiers = 7 if lod == 0 else 3
    for i in range(n_tiers):
        t0 = i / n_tiers
        ty0 = y1 - (y1 - y0) * (1.0 - t0 * 0.72)
        ty1 = y1 - (y1 - y0) * (1.0 - (t0 + 1.0 / n_tiers) * 0.72)
        tz = z0 + 0.65 + (n_tiers - i) * 0.55
        mb.add_box((x0, ty0, z0), (x1, ty1, tz), "mat_ground_concrete", skip=("-z",))
    # Rear wall & sweeping silver cantilevered sun canopy
    mb.add_box((x0, y0, z0), (x1, y0 + 1.8, z0 + 6.4), "mat_wall_pale_tile", skip=("-z",))
    mb.add_quad((x0 - 1.0, y0, z0 + 6.4), (x1 + 1.0, y0, z0 + 6.4), (x1 + 1.0, y1 - 2.0, z0 + 8.4), (x0 - 1.0, y1 - 2.0, z0 + 8.4), "mat_metal_silver")
    mb.add_quad((x1 + 1.0, y0, z0 + 6.2), (x0 - 1.0, y0, z0 + 6.2), (x0 - 1.0, y1 - 2.0, z0 + 8.2), (x1 + 1.0, y1 - 2.0, z0 + 8.2), "mat_trim_white")
    # Iconic tiled entrance pillar '运动场' (campus_playground.jpg) at east entrance of track
    px, py = -62.5, 58.0
    mb.add_box((px - 1.4, py - 0.55, z0), (px + 1.4, py + 0.55, z0 + 6.2), "mat_wall_pale_tile", skip=("-z",))
    mb.add_box((px - 1.5, py - 0.62, z0 + 6.2), (px + 1.5, py + 0.62, z0 + 6.55), "mat_trim_white")
    mb.add_box((px - 0.45, py + 0.55, z0 + 2.2), (px + 0.45, py + 0.64, z0 + 5.2), "mat_paint_gold")

    return mb.finalize(
        "stadium_grandstand", coll,
        extras={
            "haiz_building_id": b["id"],
            "haiz_district": b["district"],
            "haiz_tag": b["tag"],
            "haiz_basis": b["basis"],
            "haiz_name": b["name"],
        }
    )
