"""
HAIZ · World Reconstruction Round 2 — Tropical Botanical Flora & Human-Scale Props
==================================================================================
Generates high-craft botanical archetypes (royal palm, coconut palm, whitewashed tropical
banyan with aerial roots, textured canopy tree, frangipani, bougainvillea) and campus props
into r2_flora_kit.glb & r2_props_kit.glb, plus deterministic collision-checked instances_r2.json
that strictly respects inherited Atelier plazas/trees (Centenary Terminalia, Yanchi, Forecourt).
"""
from __future__ import annotations

import math
import numpy as np
import bpy
import bmesh
from mathutils import Vector, Matrix

from arch_detail import R2Mesh


def _add_palm_frond(
    mb: R2Mesh,
    origin: Vector,
    yaw: float,
    pitch_start: float,
    length: float,
    droop: float,
    width: float,
    mat: str,
    segs: int = 6,
):
    dx, dy = math.cos(yaw), math.sin(yaw)
    sx, sy = -dy, dx
    prev_l = prev_r = prev_c = None
    for i in range(segs + 1):
        t = i / segs
        r = length * t
        z = math.sin(pitch_start) * r - droop * (t * t) * length
        w = width * math.sin(max(0.05, t) * math.pi) * (1.15 - 0.35 * t)
        c = origin + Vector((dx * r, dy * r, z))
        pl = c + Vector((sx * w, sy * w, -w * 0.36))
        pr = c + Vector((-sx * w, -sy * w, -w * 0.36))
        if prev_c is not None:
            mb.quad(prev_c, c, pl, prev_l, mat, uv_scale=0.55)
            mb.quad(prev_r, pr, c, prev_c, mat, uv_scale=0.55)
        prev_l, prev_r, prev_c = pl, pr, c


def _add_canopy_lobe(mb: R2Mesh, center: tuple[float, float, float], rx: float, rz: float, mat: str, seed: int):
    cx, cy, cz = center
    tmp = bmesh.new()
    bmesh.ops.create_icosphere(tmp, subdivisions=2, radius=1.0)
    for v in tmp.verts:
        d = 1.0 + 0.16 * math.sin(v.co.x * 4.2 + v.co.y * 3.6 + seed) * math.cos(v.co.z * 3.4)
        v.co = Vector((cx + v.co.x * rx * d, cy + v.co.y * rx * d, cz + v.co.z * rz * d))
    for f in tmp.faces:
        pts_f = [v.co.copy() for v in f.verts]
        mb.tri(pts_f[0], pts_f[1], pts_f[2], mat, uv_scale=0.45)
    tmp.free()


def build_flora_kit_r2(mats: dict, coll: bpy.types.Collection) -> list[bpy.types.Object]:
    """Build 6 tropical Haikou botanical archetypes at origin with Round 2 PBR textures."""
    objs = []

    # 1. Royal Palm (大王椰子)
    mb = R2Mesh(mats)
    h_trunk = 8.4
    segs_z = 6
    for i in range(segs_z):
        t0, t1 = i / segs_z, (i + 1) / segs_z
        r0 = 0.28 + 0.08 * math.sin(t0 * math.pi) - 0.06 * t0
        r1 = 0.28 + 0.08 * math.sin(t1 * math.pi) - 0.06 * t1
        mb.cylinder((0, 0, t0 * h_trunk), r0, r1, (t1 - t0) * h_trunk, 8, "r2_stone_carved_pale")
    mb.cylinder((0, 0, h_trunk), 0.23, 0.20, 1.55, 8, "r2_foliage_hedge")
    crown = Vector((0, 0, h_trunk + 1.45))
    for k in range(12):
        yaw = k * (math.tau / 12.0) + (0.2 if k % 2 else 0.0)
        pitch = 0.56 if (k % 2 == 0) else 0.20
        _add_palm_frond(mb, crown, yaw, pitch, 3.65, 0.42 if k % 2 == 0 else 0.54, 0.68, "r2_foliage_palm", segs=6)
    objs.append(mb.finalize("r2_flora_royal_palm", coll, smooth=True, extras={"haiz_archetype": "royal_palm"}))

    # 2. Coconut Palm (椰子树)
    mb = R2Mesh(mats)
    h_c = 9.2
    pts = [Vector((0.78 * ((i / 6.0) ** 1.65), 0.24 * math.sin((i / 6.0) * 2.4), (i / 6.0) * h_c)) for i in range(7)]
    mb.tube(pts, 0.17, 7, "r2_bark")
    top_c = pts[-1]
    for k in range(4):
        a = k * math.pi * 0.5
        mb.cylinder((top_c.x + 0.16 * math.cos(a), top_c.y + 0.16 * math.sin(a), top_c.z - 0.35), 0.11, 0.09, 0.28, 6, "r2_foliage_hedge")
    for k in range(10):
        yaw = k * (math.tau / 10.0)
        pitch = 0.40 if (k % 2 == 0) else 0.10
        _add_palm_frond(mb, top_c, yaw, pitch, 3.9, 0.58, 0.62, "r2_foliage_palm", segs=6)
    objs.append(mb.finalize("r2_flora_coconut_palm", coll, smooth=True, extras={"haiz_archetype": "coconut_palm"}))

    # 3. Tropical Banyan (热带榕树 — whitewashed trunk + spreading crown + hanging aerial roots)
    mb = R2Mesh(mats)
    mb.cylinder((0, 0, 0.0), 0.58, 0.42, 1.35, 9, "r2_wall_white_matte")
    mb.cylinder((0, 0, 1.35), 0.42, 0.34, 1.85, 8, "r2_bark")
    for k in range(5):
        a = k * (math.tau / 5.0) + 0.25
        xf = Matrix.Translation((0, 0, 2.8)) @ Matrix.Rotation(a, 4, "Z") @ Matrix.Rotation(0.85, 4, "Y")
        mb.cylinder((0, 0, 0.0), 0.20, 0.11, 3.4, 6, "r2_bark", xform=xf)
        mb.cylinder((math.cos(a) * 2.0, math.sin(a) * 2.0, 0.0), 0.035, 0.025, 3.9, 5, "r2_bark")
    _add_canopy_lobe(mb, (0, 0, 6.2), 3.3, 2.1, "r2_foliage_leaf", 11)
    for k in range(6):
        _add_canopy_lobe(mb, (math.cos(k * 1.05) * 2.6, math.sin(k * 1.05) * 2.6, 5.1 + (k % 2) * 0.7), 2.25, 1.55, "r2_foliage_leaf", 20 + k)
    objs.append(mb.finalize("r2_flora_banyan", coll, smooth=True, extras={"haiz_archetype": "banyan"}))

    # 4. Terminalia / Jackfruit Shade Tree (榄仁/菠萝蜜树)
    mb = R2Mesh(mats)
    mb.cylinder((0, 0, 0.0), 0.42, 0.30, 1.30, 8, "r2_wall_white_matte")
    mb.cylinder((0, 0, 1.30), 0.30, 0.22, 3.60, 8, "r2_bark")
    for t_z, r_c in ((4.2, 3.5), (5.6, 2.9), (6.9, 1.9)):
        _add_canopy_lobe(mb, (0, 0, t_z), r_c, 0.85, "r2_foliage_leaf", int(t_z * 10))
    objs.append(mb.finalize("r2_flora_terminalia", coll, smooth=True, extras={"haiz_archetype": "terminalia"}))

    # 5. Frangipani Garden Tree (鸡蛋花)
    mb = R2Mesh(mats)
    mb.cylinder((0, 0, 0.0), 0.22, 0.16, 1.85, 7, "r2_bark")
    for k in range(4):
        a = k * (math.tau / 4.0) + 0.4
        xf = Matrix.Translation((0, 0, 1.75)) @ Matrix.Rotation(a, 4, "Z") @ Matrix.Rotation(0.75, 4, "Y")
        mb.cylinder((0, 0, 0.0), 0.12, 0.08, 1.7, 6, "r2_bark", xform=xf)
        _add_canopy_lobe(mb, (math.cos(a) * 1.2, math.sin(a) * 1.2, 2.95), 1.35, 0.85, "r2_foliage_hedge", 50 + k)
    _add_canopy_lobe(mb, (0, 0, 3.45), 1.55, 0.90, "r2_foliage_leaf", 60)
    objs.append(mb.finalize("r2_flora_frangipani", coll, smooth=True, extras={"haiz_archetype": "frangipani"}))

    # 6. Flowering Bougainvillea Shrub (三角梅花坛)
    mb = R2Mesh(mats)
    _add_canopy_lobe(mb, (0, 0, 0.55), 0.95, 0.65, "r2_foliage_hedge", 71)
    for k in range(4):
        a = k * 1.57 + 0.3
        _add_canopy_lobe(mb, (math.cos(a) * 0.42, math.sin(a) * 0.42, 0.78), 0.46, 0.36, "r2_flower_pink", 80 + k)
    objs.append(mb.finalize("r2_flora_bougainvillea", coll, smooth=True, extras={"haiz_archetype": "bougainvillea"}))

    return objs


def build_props_kit_r2(mats: dict, coll: bpy.types.Collection) -> list[bpy.types.Object]:
    """Build crisp human-scale campus props matching Round 2 PBR library."""
    objs = []

    # 1. Three-globe Heritage Lamp Post
    mb = R2Mesh(mats)
    mb.cylinder((0, 0, 0.0), 0.18, 0.14, 0.55, 8, "r2_stone_granite_dark")
    mb.cylinder((0, 0, 0.55), 0.085, 0.06, 3.65, 8, "r2_mullion_bronze")
    mb.box((-0.65, -0.04, 3.82), (0.65, 0.04, 3.92), "r2_mullion_bronze")
    for gx, gz in ((-0.58, 4.15), (0.0, 4.48), (0.58, 4.15)):
        mb.cylinder((gx, 0, gz - 0.25), 0.04, 0.04, 0.20, 6, "r2_mullion_bronze")
        _add_canopy_lobe(mb, (gx, 0, gz), 0.19, 0.19, "r2_trim_white", 90)
    objs.append(mb.finalize("r2_prop_lamp", coll, extras={"haiz_prop": "lamp_3globe"}))

    # 2. Shaded Timber & Granite Bench
    mb = R2Mesh(mats)
    for sx in (-0.75, 0.75):
        mb.box((sx - 0.10, -0.26, 0.0), (sx + 0.10, 0.26, 0.42), "r2_stone_granite_grey")
    for sy in (-0.18, 0.0, 0.18):
        mb.box((-0.95, sy - 0.06, 0.42), (0.95, sy + 0.06, 0.49), "r2_wood_golden")
    mb.box((-0.95, -0.25, 0.52), (0.95, -0.18, 0.88), "r2_wood_golden")
    objs.append(mb.finalize("r2_prop_bench", coll, extras={"haiz_prop": "bench"}))

    # 3. Basketball Hoop Stand
    mb = R2Mesh(mats)
    mb.cylinder((0, -0.55, 0.0), 0.10, 0.08, 3.15, 8, "r2_mullion_bronze")
    mb.box((-0.07, -0.55, 2.95), (0.07, 0.42, 3.12), "r2_mullion_bronze")
    mb.box((-0.90, 0.42, 2.75), (0.90, 0.48, 3.80), "r2_trim_white")
    mb.box((-0.30, 0.40, 2.92), (0.30, 0.41, 3.36), "r2_fret_ochre")
    mb.cylinder((0, 0.68, 3.02), 0.24, 0.24, 0.05, 12, "r2_lacquer_crimson")
    objs.append(mb.finalize("r2_prop_hoop", coll, extras={"haiz_prop": "basketball_hoop"}))

    # 4. Heritage Exhibition Bulletin Board
    mb = R2Mesh(mats)
    for sx in (-1.15, 1.15):
        mb.cylinder((sx, 0, 0.0), 0.055, 0.055, 2.25, 8, "r2_mullion_bronze")
    mb.box((-1.25, -0.10, 0.85), (1.25, 0.10, 2.15), "r2_fret_green")
    mb.box((-1.14, -0.12, 0.96), (1.14, 0.12, 2.04), "r2_trim_white")
    mb.box((-1.35, -0.32, 2.15), (1.35, 0.32, 2.30), "r2_roof_emerald")
    objs.append(mb.finalize("r2_prop_bulletin", coll, extras={"haiz_prop": "bulletin_board"}))

    # 5. Campus Covered Bike Rack
    mb = R2Mesh(mats)
    for sx in (-2.4, 2.4):
        for sy in (-0.8, 0.8):
            mb.cylinder((sx, sy, 0.0), 0.05, 0.05, 2.15, 6, "r2_mullion_bronze")
    mb.quad((-2.6, -1.0, 2.12), (2.6, -1.0, 2.12), (2.6, 1.0, 2.32), (-2.6, 1.0, 2.32), "r2_glass_turquoise")
    mb.box((-2.2, -0.05, 0.0), (2.2, 0.05, 0.14), "r2_mullion_silver")
    for bx in (-1.65, -0.55, 0.55, 1.65):
        mb.box((bx - 0.03, -0.52, 0.55), (bx + 0.03, 0.45, 0.62), "r2_lacquer_crimson" if bx >= 0 else "r2_fret_green")
    objs.append(mb.finalize("r2_prop_bike_rack", coll, extras={"haiz_prop": "bike_rack"}))

    return objs


def generate_instances_r2(spec: dict) -> dict:
    """
    Generate non-overlapping deterministic transforms for Round 2 flora & props:
      - Strictly excludes Atelier Centenary Terminalia radius (19.0 m around (38.91, 17.67))
      - Strictly excludes Atelier forecourt plazas, Taihu, Yanchi, Heritage Hall footprints
      - Frames North Gate -> Block 1 Palm Avenue, Fengqitang courtyard, Keji lawns, Yanchi palms, & track
    """
    rng = np.random.default_rng(20261128)
    b_boxes = [b["bbox"] for b in spec["buildings"]]
    yanchi_bb = spec["yanchi"]["bbox"]
    sports_bbs = [s["bbox"] for s in spec["sports_and_landuse"] if s["kind"] in ("basketball_court", "volleyball_court", "football_pitch", "stadium_track")]

    def clear_of_obstacles(x: float, y: float, pad: float = 3.0) -> bool:
        # Forecourt paved central plaza, Yihao terraces & Taihu Rock
        if -58.0 < x < 58.0 and -2.5 < y < 31.5:
            return False
        # Forecourt carriageway & axial roadway
        if -12.0 < x < 12.0 and 29.0 < y < 122.0:
            return False
        # Inherited Atelier Centenary Terminalia canopy clearance
        if math.hypot(x - 38.91, y - 17.67) < 18.5:
            return False
        # Yanchi water basin
        if yanchi_bb[0] - 1.5 < x < yanchi_bb[2] + 1.5 and yanchi_bb[1] - 1.5 < y < yanchi_bb[3] + 1.5:
            return False
        # Keji foreground lawn allows palm accent along south curb only outside steps/sidewalk
        for x0, y0, x1, y1 in b_boxes:
            if x0 - pad < x < x1 + pad and y0 - pad < y < y1 + pad:
                return False
        for x0, y0, x1, y1 in sports_bbs:
            if x0 - 1.8 < x < x1 + 1.8 and y0 - 1.8 < y < y1 + 1.8:
                return False
        for rd in spec["roads"]:
            hw = rd["width"] * 0.5 + 1.3
            pts = rd["pts"]
            for a, b in zip(pts[:-1], pts[1:]):
                dx, dy = b[0] - a[0], b[1] - a[1]
                l2 = dx * dx + dy * dy + 1e-6
                t = max(0.0, min(1.0, ((x - a[0]) * dx + (y - a[1]) * dy) / l2))
                if math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy)) < hw:
                    return False
        return True

    flora = {k: [] for k in ("royal_palm", "coconut_palm", "banyan", "terminalia", "frangipani", "bougainvillea")}
    props = {k: [] for k in ("lamp_3globe", "bench", "basketball_hoop", "bulletin_board", "bike_rack")}

    def add_f(kind: str, x: float, y: float, z: float = 0.15, scale: float = 1.0, rot: float | None = None):
        flora[kind].append([round(x, 2), round(y, 2), round(z, 2), round(scale, 3), round(rot if rot is not None else float(rng.uniform(0, 6.283)), 3)])

    def add_p(kind: str, x: float, y: float, z: float = 0.15, rot: float = 0.0, scale: float = 1.0):
        props[kind].append([round(x, 2), round(y, 2), round(z, 2), round(scale, 3), round(rot, 3)])

    # 1. Ceremonial Royal Palms flanking North Gate Axis & Forecourt Lawns (matching hero-2560!)
    for y in np.linspace(54.0, 96.0, 8):
        add_f("royal_palm", -8.0, float(y), 0.15, float(rng.uniform(0.95, 1.15)))
        add_f("royal_palm", 8.0, float(y), 0.15, float(rng.uniform(0.95, 1.15)))
    for x, y, sc in [(-16.0, 34.0, 1.1), (-24.0, 26.0, 1.05), (16.5, 34.0, 1.05), (-52.0, 26.0, 1.12)]:
        add_f("royal_palm", x, y, 0.15, sc)
    # Lush banyans framing North Gate exterior & Keji lawn edges (campus_keji.jpg & hero-2560.jpg!)
    for x, y, sc in [(-14.5, 113.0, 1.15), (14.5, 113.0, 1.15), (14.0, 74.0, 0.95), (61.5, 76.0, 1.05)]:
        add_f("banyan", x, y, 0.15, sc)

    # 2. Yanchi Palms & Sports Field Horizon Coconuts
    for p in spec["yanchi"]["palms"]["positions"]:
        add_f("coconut_palm", p[0], p[1], 0.15, p[2] / 11.0, math.atan2(46.6 - p[0], -114.5 - p[1]))
    for x, y in [(-66.0, 72.0), (-68.0, 88.0), (-82.0, 118.0), (-118.0, 125.0), (-175.0, 122.0), (-212.0, 85.0)]:
        add_f("coconut_palm", x, y, 0.15, float(rng.uniform(0.95, 1.25)))

    # 3. Frangipani & Banyans framing Heritage Precinct + Library South-West Garden
    for x, y in [
        (-52.5, 58.0), (-27.0, 66.0), (-50.0, 89.0),
        (59.0, 50.0), (77.0, 50.0), (58.0, 74.0),
        (-34.0, 50.0), (26.0, 50.0), (42.0, 52.0), (86.0, 38.0),
    ]:
        if clear_of_obstacles(x, y, pad=1.6):
            add_f("frangipani", x, y, 0.15, float(rng.uniform(0.92, 1.18)))

    # 4. Southwest Botanical Grove & Campus-wide Tropical Trees
    for _ in range(36):
        gx = float(rng.uniform(-162.0, -94.0))
        gy = float(rng.uniform(-194.0, -134.0))
        if clear_of_obstacles(gx, gy, pad=2.2):
            kind = str(rng.choice(["banyan", "terminalia", "coconut_palm", "frangipani"], p=[0.42, 0.28, 0.18, 0.12]))
            add_f(kind, gx, gy, 0.15, float(rng.uniform(0.88, 1.28)))

    for _ in range(260):
        tx = float(rng.uniform(-225.0, 210.0))
        ty = float(rng.uniform(-245.0, 118.0))
        if not clear_of_obstacles(tx, ty, pad=3.2):
            continue
        too_close = any(math.hypot(p[0] - tx, p[1] - ty) < 9.0 for lst in flora.values() for p in lst[-80:])
        if too_close:
            continue
        kind = str(rng.choice(["banyan", "terminalia", "royal_palm", "coconut_palm"], p=[0.36, 0.30, 0.20, 0.14]))
        add_f(kind, tx, ty, 0.15, float(rng.uniform(0.84, 1.22)))

    # 5. Bougainvillea accents
    for bx, by in [
        (-15.8, 31.8), (15.8, 31.8), (-38.0, 22.0), (-26.0, 22.0),
        (36.0, -106.5), (50.0, -106.5), (74.5, 18.0), (74.5, 4.0),
        (-73.0, -12.0), (-73.0, -48.0), (-73.0, -96.0),
    ]:
        add_f("bougainvillea", bx, by, 0.15, float(rng.uniform(0.85, 1.20)))

    # 6. Props (lamps, benches, 12 hoops, bulletin boards, bike racks)
    for y in (58.0, 76.0, 92.0):
        add_p("lamp_3globe", -6.5, y, 0.15, 0.0)
        add_p("lamp_3globe", 6.5, y, 0.15, 0.0)
    for x in (-110.0, -82.0, 82.0, 110.0):
        add_p("lamp_3globe", x, 42.0, 0.15, 0.0)
    for y in (-16.0, -56.0, -96.0, -138.0, -182.0):
        add_p("lamp_3globe", 63.8, y, 0.15, math.pi * 0.5)
        add_p("lamp_3globe", -63.8, y, 0.15, math.pi * 0.5)
    for bx, by, rot, bz in [
        (-22.0, 22.0, math.pi, 0.15), (-32.0, 22.0, math.pi, 0.15),
        (42.0, -106.0, math.pi, 0.15), (65.5, -118.0, -math.pi * 0.5, 0.15),
        (73.5, 14.0, -math.pi * 0.5, 0.15), (73.5, -4.0, -math.pi * 0.5, 0.15),
    ]:
        add_p("bench", bx, by, bz, rot)
    for sf in spec["sports_and_landuse"]:
        if sf["kind"] != "basketball_court":
            continue
        x0, y0, x1, y1 = sf["bbox"]
        cx = 0.5 * (x0 + x1)
        add_p("basketball_hoop", cx, y0 + 1.4, 0.15, 0.0)
        add_p("basketball_hoop", cx, y1 - 1.4, 0.15, math.pi)
    for bx, by, rot in [(-12.0, -68.5, 0.0), (-4.0, -68.5, 0.0), (4.0, -68.5, 0.0), (72.5, 28.0, -math.pi * 0.5)]:
        add_p("bulletin_board", bx, by, 0.15, rot)
    for bx, by, rot in [(-59.5, 34.0, math.pi * 0.5), (73.0, -24.0, math.pi * 0.5), (123.0, -135.0, math.pi * 0.5), (-73.5, -104.0, math.pi * 0.5)]:
        add_p("bike_rack", bx, by, 0.15, rot)

    return {"flora": flora, "props": props}
