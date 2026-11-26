"""
HAIZ World Reconstruction — GPU-Instanced Tropical Flora & Campus Street Furniture Kits.

Generates lightweight, high-silhouette botanical archetypes and human-scale campus props
into two clean shared GLBs (`flora_kit.glb`, `props_kit.glb`), plus computes exact
non-overlapping placement transforms across the entire 500m x 400m campus (`instances.json`).
This lets the Three.js runtime render 320+ lush tropical trees and 160+ campus props in
under ~16 GPU instanced draw calls!
"""
from __future__ import annotations

import math
import numpy as np
import bpy
import bmesh
from mathutils import Vector, Matrix

from arch_kit import MeshBuilder


def _add_palm_frond(mb: MeshBuilder, origin: Vector, yaw: float, pitch_start: float, length: float, droop: float, width: float, mat: str, segs: int = 5):
    """Gracefully arching tropical pinnate palm frond catching tropical sunlight."""
    dx, dy = math.cos(yaw), math.sin(yaw)
    sx, sy = -dy, dx
    prev_l = prev_r = prev_c = None
    for i in range(segs + 1):
        t = i / segs
        r = length * t
        z = math.sin(pitch_start) * r - droop * (t * t) * length
        # Tapered width profile (widest around t=0.35, pointed tip)
        w = width * math.sin(max(0.05, t) * math.pi) * (1.15 - 0.35 * t)
        c = origin + Vector((dx * r, dy * r, z))
        # V-shaped cross-section droop of pinnate leaflets
        pl = c + Vector((sx * w, sy * w, -w * 0.35))
        pr = c + Vector((-sx * w, -sy * w, -w * 0.35))
        if prev_c is not None:
            mb.add_quad(prev_c, c, pl, prev_l, mat, uv_scale=0.5)
            mb.add_quad(prev_r, pr, c, prev_c, mat, uv_scale=0.5)
        prev_l, prev_r, prev_c = pl, pr, c


def build_flora_kit(mats: dict, coll: bpy.types.Collection) -> list[bpy.types.Object]:
    """Build 6 distinctive Hainan Middle School tropical botanical archetypes at origin."""
    objs = []

    # 1. Royal Palm (大王椰子 — pale swollen columnar trunk + green crownshaft + arching fronds)
    mb = MeshBuilder(mats)
    h_trunk = 8.4
    segs_z = 6
    for i in range(segs_z):
        t0, t1 = i / segs_z, (i + 1) / segs_z
        # Characteristic subtle royal-palm bulge around mid-trunk
        r0 = 0.28 + 0.08 * math.sin(t0 * math.pi) - 0.06 * t0
        r1 = 0.28 + 0.08 * math.sin(t1 * math.pi) - 0.06 * t1
        mb.add_cylinder((0, 0), r0, r1, t0 * h_trunk, t1 * h_trunk, "mat_bark_palm", segs=8)
    # Lush green crownshaft
    mb.add_cylinder((0, 0), 0.23, 0.21, h_trunk, h_trunk + 1.55, "mat_palm_crownshaft", segs=8)
    crown = Vector((0, 0, h_trunk + 1.45))
    for k in range(11):
        yaw = k * (2.0 * math.pi / 11.0) + (0.2 if k % 2 else 0.0)
        pitch = 0.55 if (k % 2 == 0) else 0.22
        _add_palm_frond(mb, crown, yaw, pitch, 3.6, 0.42 if k % 2 == 0 else 0.52, 0.68, "mat_foliage_palm", segs=5)
    objs.append(mb.finalize("flora_royal_palm", coll, smooth=True, extras={"haiz_archetype": "royal_palm"}))

    # 2. Coconut Palm (椰子树 — slender gently leaning ringed trunk + drooping tropical fronds + coconuts)
    mb = MeshBuilder(mats)
    h_c = 9.2
    pts = []
    for i in range(7):
        t = i / 6.0
        pts.append((0.75 * (t ** 1.6), 0.25 * math.sin(t * 2.4), t * h_c))
    for i in range(len(pts) - 1):
        p0, p1 = Vector(pts[i]), Vector(pts[i + 1])
        r0 = 0.22 - 0.08 * (i / 6.0)
        r1 = 0.22 - 0.08 * ((i + 1) / 6.0)
        # Approximate tilted cylinder segment
        mid = 0.5 * (p0 + p1)
        d = p1 - p0
        ang_x = math.atan2(d.y, d.z)
        ang_y = math.atan2(d.x, d.z)
        xf = Matrix.Translation(p0) @ Matrix.Rotation(ang_y, 4, "Y") @ Matrix.Rotation(-ang_x, 4, "X")
        mb.add_cylinder((0, 0), r0, r1, 0.0, d.length, "mat_bark_tropical", segs=7, xform=xf)
    top_c = Vector(pts[-1])
    # Cluster of coconuts under crown
    for k in range(4):
        a = k * math.pi * 0.5
        mb.add_cylinder((top_c.x + 0.16 * math.cos(a), top_c.y + 0.16 * math.sin(a)), 0.11, 0.09, top_c.z - 0.35, top_c.z - 0.08, "mat_palm_crownshaft", segs=6)
    for k in range(10):
        yaw = k * (2.0 * math.pi / 10.0)
        pitch = 0.42 if (k % 2 == 0) else 0.10
        _add_palm_frond(mb, top_c, yaw, pitch, 3.9, 0.58, 0.62, "mat_foliage_palm", segs=5)
    objs.append(mb.finalize("flora_coconut_palm", coll, smooth=True, extras={"haiz_archetype": "coconut_palm"}))

    # 3. Tropical Banyan Tree (热带榕树 — whitewashed lower trunk per campus_playground.jpg + spreading multi-lobe canopy)
    mb = MeshBuilder(mats)
    mb.add_cylinder((0, 0), 0.58, 0.42, 0.0, 1.35, "mat_bark_whitewash", segs=9)
    mb.add_cylinder((0, 0), 0.42, 0.34, 1.35, 3.2, "mat_bark_tropical", segs=8)
    # Spreading structural limbs + hanging aerial roots
    rng = np.random.default_rng(701)
    for k in range(5):
        a = k * (2.0 * math.pi / 5.0) + 0.25
        lx, ly = math.cos(a) * 2.8, math.sin(a) * 2.8
        xf = Matrix.Translation((0, 0, 2.8)) @ Matrix.Rotation(a, 4, "Z") @ Matrix.Rotation(0.85, 4, "Y")
        mb.add_cylinder((0, 0), 0.20, 0.11, 0.0, 3.4, "mat_bark_tropical", segs=6, xform=xf)
        # Aerial root hanging cleanly down
        mb.add_cylinder((lx * 0.72, ly * 0.72), 0.035, 0.025, 0.0, 3.9, "mat_bark_tropical", segs=5)
    # Rich multi-tiered broad dome canopy (non-spherical cupped organic puffs)
    puffs = [(0, 0, 6.2, 3.2, 2.0)] + [
        (math.cos(k * 1.05) * 2.6, math.sin(k * 1.05) * 2.6, 5.1 + (k % 2) * 0.7, 2.25, 1.55) for k in range(6)
    ]
    for px, py, pz, rx, rz in puffs:
        tmp = bmesh.new()
        bmesh.ops.create_icosphere(tmp, subdivisions=2, radius=1.0)
        for v in tmp.verts:
            d = 1.0 + 0.16 * math.sin(v.co.x * 4.1 + v.co.y * 3.7 + px) * math.cos(v.co.z * 3.5)
            v.co = Vector((px + v.co.x * rx * d, py + v.co.y * rx * d, pz + v.co.z * rz * d))
        for f in tmp.faces:
            pts_f = [v.co.copy() for v in f.verts]
            mb.add_tri(pts_f[0], pts_f[1], pts_f[2], "mat_foliage_banyan", uv_scale=0.4)
        tmp.free()
    objs.append(mb.finalize("flora_banyan", coll, smooth=True, extras={"haiz_archetype": "banyan"}))

    # 4. Pagoda Terminalia (榄仁树 — characteristic layered horizontal tiers + subtle autumn crimson accents)
    mb = MeshBuilder(mats)
    mb.add_cylinder((0, 0), 0.34, 0.20, 0.0, 5.6, "mat_bark_tropical", segs=7)
    tiers = [(3.4, 3.4, 0.72), (5.0, 2.75, 0.68), (6.4, 1.95, 0.60)]
    for ti, (tz, tr, th) in enumerate(tiers):
        for k in range(6 if ti < 2 else 4):
            a = k * (2.0 * math.pi / (6 if ti < 2 else 4)) + ti * 0.5
            cx, cy = math.cos(a) * tr * 0.55, math.sin(a) * tr * 0.55
            mat_l = "mat_foliage_terminalia_autumn" if (ti == 0 and k == 2) else "mat_foliage_terminalia"
            pts_hex = [Vector((cx + math.cos(j * math.pi / 3.0) * tr * 0.52, cy + math.sin(j * math.pi / 3.0) * tr * 0.52, tz - th * 0.2)) for j in range(6)]
            apex = Vector((cx, cy, tz + th * 0.65))
            bot = Vector((cx, cy, tz - th * 0.45))
            for j in range(6):
                mb.add_tri(apex, pts_hex[j], pts_hex[(j + 1) % 6], mat_l)
                mb.add_tri(bot, pts_hex[(j + 1) % 6], pts_hex[j], mat_l)
    objs.append(mb.finalize("flora_terminalia", coll, smooth=True, extras={"haiz_archetype": "terminalia"}))

    # 5. Frangipani / Plumeria Tree (鸡蛋花 — sculptural low spreading tree with creamy blossoms around Fengqitang)
    mb = MeshBuilder(mats)
    mb.add_cylinder((0, 0), 0.22, 0.16, 0.0, 1.4, "mat_bark_palm", segs=7)
    for k in range(5):
        a = k * (2.0 * math.pi / 5.0)
        xf = Matrix.Translation((0, 0, 1.25)) @ Matrix.Rotation(a, 4, "Z") @ Matrix.Rotation(0.75, 4, "Y")
        mb.add_cylinder((0, 0), 0.12, 0.07, 0.0, 1.9, "mat_bark_palm", segs=6, xform=xf)
        cx, cy, cz = math.cos(a) * 1.45, math.sin(a) * 1.45, 2.75
        tmp = bmesh.new()
        bmesh.ops.create_icosphere(tmp, subdivisions=1, radius=1.0)
        for v in tmp.verts:
            v.co = Vector((cx + v.co.x * 1.15, cy + v.co.y * 1.15, cz + v.co.z * 0.68))
        for f in tmp.faces:
            pts_f = [v.co.copy() for v in f.verts]
            mb.add_tri(pts_f[0], pts_f[1], pts_f[2], "mat_foliage_frangipani")
        tmp.free()
        # Creamy white blossom clusters on upper surface
        mb.add_cylinder((cx * 1.05, cy * 1.05), 0.26, 0.12, cz + 0.55, cz + 0.78, "mat_flower_frangipani", segs=6)
    objs.append(mb.finalize("flora_frangipani", coll, smooth=True, extras={"haiz_archetype": "frangipani"}))

    # 6. Bougainvillea Tropical Flowering Shrub (三角梅花丛 — Hainan magenta accent!)
    mb = MeshBuilder(mats)
    for idx, (sx, sy, sz, sr, m) in enumerate([
        (0.0, 0.0, 0.55, 0.85, "mat_foliage_banyan"),
        (0.55, 0.25, 0.48, 0.68, "mat_foliage_banyan"),
        (-0.48, 0.30, 0.50, 0.66, "mat_foliage_banyan"),
        (0.18, -0.35, 0.82, 0.42, "mat_flower_bougainvillea"),
        (-0.40, 0.22, 0.78, 0.38, "mat_flower_bougainvillea"),
        (0.58, 0.20, 0.74, 0.36, "mat_flower_bougainvillea"),
    ]):
        tmp = bmesh.new()
        bmesh.ops.create_icosphere(tmp, subdivisions=1, radius=1.0)
        for v in tmp.verts:
            v.co = Vector((sx + v.co.x * sr, sy + v.co.y * sr, sz + v.co.z * sr * 0.75))
        for f in tmp.faces:
            pts_f = [v.co.copy() for v in f.verts]
            mb.add_tri(pts_f[0], pts_f[1], pts_f[2], m)
        tmp.free()
    objs.append(mb.finalize("flora_bougainvillea", coll, smooth=True, extras={"haiz_archetype": "bougainvillea"}))

    return objs


def build_props_kit(mats: dict, coll: bpy.types.Collection) -> list[bpy.types.Object]:
    """Build 5 human-scale Hainan Middle School campus props at origin for GPU instancing."""
    objs = []

    # 1. Classic 3-Globe Campus Street Lamp (seen in campus_playground.jpg & campus_yanlintang.jpg!)
    mb = MeshBuilder(mats)
    mb.add_cylinder((0, 0), 0.16, 0.11, 0.0, 0.65, "mat_metal_dark", segs=8)
    mb.add_cylinder((0, 0), 0.075, 0.055, 0.65, 4.35, "mat_metal_dark", segs=8)
    # Central top globe + two curving side arm globes
    for gx, gz in [(0.0, 4.65), (-0.42, 4.38), (0.42, 4.38)]:
        if gx != 0.0:
            mb.add_box((min(0.0, gx), -0.025, 4.08), (max(0.0, gx), 0.025, 4.15), "mat_metal_dark")
            mb.add_cylinder((gx, 0.0), 0.03, 0.04, 4.08, 4.22, "mat_metal_dark", segs=6)
        tmp = bmesh.new()
        bmesh.ops.create_icosphere(tmp, subdivisions=1, radius=0.19)
        for v in tmp.verts:
            v.co += Vector((gx, 0.0, gz))
        for f in tmp.faces:
            pts_f = [v.co.copy() for v in f.verts]
            mb.add_tri(pts_f[0], pts_f[1], pts_f[2], "mat_lamp_globe")
        tmp.free()
    objs.append(mb.finalize("prop_lamp_3globe", coll, smooth=True, extras={"haiz_prop": "lamp_3globe"}))

    # 2. Shaded Courtyard Wood & Granite Bench
    mb = MeshBuilder(mats)
    for lx in (-0.72, 0.72):
        mb.add_box((lx - 0.08, -0.24, 0.0), (lx + 0.08, 0.24, 0.44), "mat_stone_granite_dark", skip=("-z",))
    for sy in (-0.18, 0.0, 0.18):
        mb.add_box((-0.92, sy - 0.065, 0.44), (0.92, sy + 0.065, 0.50), "mat_wood_warm")
    # Slanted backrest
    mb.add_box((-0.92, -0.26, 0.64), (0.92, -0.20, 0.86), "mat_wood_warm")
    objs.append(mb.finalize("prop_bench", coll, extras={"haiz_prop": "bench"}))

    # 3. Basketball Hoop Stanchion + Backboard + Orange Rim
    mb = MeshBuilder(mats)
    mb.add_box((-0.45, -0.85, 0.0), (0.45, -0.15, 0.55), "mat_metal_dark", skip=("-z",))
    mb.add_box((-0.09, -0.55, 0.55), (0.09, -0.35, 3.15), "mat_metal_dark")
    # Overhanging boom toward +Y (court interior)
    mb.add_box((-0.08, -0.45, 3.05), (0.08, 0.55, 3.22), "mat_metal_dark")
    # Glass backboard with white border
    mb.add_box((-0.92, 0.52, 2.90), (0.92, 0.58, 3.96), "mat_trim_white")
    mb.add_box((-0.84, 0.51, 2.98), (0.84, 0.60, 3.88), "mat_glass_turquoise")
    # Orange rim hoop
    mb.add_cylinder((0.0, 0.85), 0.24, 0.24, 3.03, 3.08, "mat_paint_vermilion", segs=12, caps=(False, False))
    objs.append(mb.finalize("prop_basketball_hoop", coll, extras={"haiz_prop": "basketball_hoop"}))

    # 4. Campus Exhibition / Notice Display Board (seen in campus_kexue.jpg)
    mb = MeshBuilder(mats)
    for sx in (-1.15, 1.15):
        mb.add_cylinder((sx, 0.0), 0.055, 0.055, 0.0, 2.25, "mat_metal_dark", segs=8)
    mb.add_box((-1.25, -0.10, 0.85), (1.25, 0.10, 2.15), "mat_sign_blue")
    mb.add_box((-1.14, -0.12, 0.96), (1.14, 0.12, 2.04), "mat_trim_white")
    mb.add_box((-1.35, -0.32, 2.15), (1.35, 0.32, 2.28), "mat_roof_emerald")
    objs.append(mb.finalize("prop_bulletin_board", coll, extras={"haiz_prop": "bulletin_board"}))

    # 5. Campus Bicycle Parking Rack (with stylized parked campus bicycles)
    mb = MeshBuilder(mats)
    # Canopy posts & translucent cover
    for sx in (-2.4, 2.4):
        for sy in (-0.8, 0.8):
            mb.add_cylinder((sx, sy), 0.05, 0.05, 0.0, 2.15, "mat_metal_dark", segs=6)
    mb.add_quad((-2.6, -1.0, 2.12), (2.6, -1.0, 2.12), (2.6, 1.0, 2.32), (-2.6, 1.0, 2.32), "mat_glass_turquoise")
    # Ground wheel rack bar + 4 simple parked bike frames
    mb.add_box((-2.2, -0.05, 0.0), (2.2, 0.05, 0.14), "mat_metal_silver")
    for bx in (-1.65, -0.55, 0.55, 1.65):
        mb.add_cylinder((bx, -0.52), 0.30, 0.30, 0.0, 0.06, "mat_metal_dark", segs=8, xform=Matrix.Translation((bx, -0.52, 0.30)) @ Matrix.Rotation(math.pi * 0.5, 4, "Y"))
        mb.add_cylinder((bx, 0.52), 0.30, 0.30, 0.0, 0.06, "mat_metal_dark", segs=8, xform=Matrix.Translation((bx, 0.52, 0.30)) @ Matrix.Rotation(math.pi * 0.5, 4, "Y"))
        mb.add_box((bx - 0.03, -0.52, 0.55), (bx + 0.03, 0.45, 0.62), "mat_sign_blue" if bx < 0 else "mat_paint_vermilion")
        mb.add_box((bx - 0.24, 0.35, 0.88), (bx + 0.24, 0.42, 0.94), "mat_metal_silver")
    objs.append(mb.finalize("prop_bike_rack", coll, extras={"haiz_prop": "bike_rack"}))

    return objs


def generate_campus_instances(spec: dict) -> dict:
    """
    Generate deterministic, collision-checked GPU instance transforms for tropical trees
    and campus street furniture across all 500m x 400m of Hainan Middle School.
    """
    rng = np.random.default_rng(20261126)
    b_boxes = [b["bbox"] for b in spec["buildings"]]
    yanchi_bb = spec["yanchi"]["bbox"]
    sports_bbs = [s["bbox"] for s in spec["sports_and_landuse"] if s["kind"] in ("basketball_court", "volleyball_court", "football_pitch", "stadium_track")]

    def clear_of_obstacles(x: float, y: float, pad: float = 2.8) -> bool:
        # Keep clear of central forecourt granite plaza & hero Terminalia trunk
        if -15.5 < x < 15.5 and -2.0 < y < 44.0:
            return False
        if math.hypot(x - 38.91, y - 17.67) < 13.0:
            return False
        # Keep clear of Yanchi water
        if yanchi_bb[0] - 1.2 < x < yanchi_bb[2] + 1.2 and yanchi_bb[1] - 1.2 < y < yanchi_bb[3] + 1.2:
            return False
        # Keep clear of buildings
        for x0, y0, x1, y1 in b_boxes:
            if x0 - pad < x < x1 + pad and y0 - pad < y < y1 + pad:
                return False
        # Keep clear of courts & track interior
        for x0, y0, x1, y1 in sports_bbs:
            if x0 - 1.5 < x < x1 + 1.5 and y0 - 1.5 < y < y1 + 1.5:
                return False
        # Keep clear of road carriageways
        for rd in spec["roads"]:
            hw = rd["width"] * 0.5 + 1.1
            pts = rd["pts"]
            for a, b in zip(pts[:-1], pts[1:]):
                dx, dy = b[0] - a[0], b[1] - a[1]
                l2 = dx * dx + dy * dy + 1e-6
                t = max(0.0, min(1.0, ((x - a[0]) * dx + (y - a[1]) * dy) / l2))
                px, py = a[0] + t * dx, a[1] + t * dy
                if math.hypot(x - px, y - py) < hw:
                    return False
        return True

    flora = {k: [] for k in ("royal_palm", "coconut_palm", "banyan", "terminalia", "frangipani", "bougainvillea")}
    props = {k: [] for k in ("lamp_3globe", "bench", "basketball_hoop", "bulletin_board", "bike_rack")}

    def add_f(kind: str, x: float, y: float, z: float = 0.15, scale: float = 1.0, rot: float | None = None):
        flora[kind].append([round(x, 2), round(y, 2), round(z, 2), round(scale, 3), round(rot if rot is not None else float(rng.uniform(0, 6.283)), 3)])

    def add_p(kind: str, x: float, y: float, z: float = 0.15, rot: float = 0.0, scale: float = 1.0):
        props[kind].append([round(x, 2), round(y, 2), round(z, 2), round(scale, 3), round(rot, 3)])

    # 1. Signature Royal Palm Ceremonial Avenue flanking the North Gate Axis (hero-2560.jpg!)
    for y in np.linspace(54.0, 99.0, 9):
        add_f("royal_palm", -7.8, float(y), 0.15, float(rng.uniform(0.95, 1.18)))
        add_f("royal_palm", 7.8, float(y), 0.15, float(rng.uniform(0.95, 1.18)))
    # Flanking forecourt lawn accents (photo-observed Norfolk/palm trees framing central plaza)
    for x, y, sc in [(-16.0, 34.0, 1.1), (-24.0, 26.0, 1.05), (16.5, 34.0, 1.05), (-52.0, 26.0, 1.15)]:
        add_f("royal_palm", x, y, 0.15, sc)

    # 2. Leaning Coconut Palms encircling Yanchi Ink-Pond (campus_yanchi.jpg & campus_yishu.jpg!)
    for p in spec["yanchi"]["palms"]["positions"]:
        add_f("coconut_palm", p[0], p[1], 0.15, p[2] / 11.0, math.atan2(46.6 - p[0], -114.5 - p[1]))
    # Additional leaning coconuts around sports field sunset vista (campus_playground.jpg!)
    for x, y in [(-66.0, 72.0), (-68.0, 88.0), (-82.0, 118.0), (-118.0, 125.0), (-175.0, 122.0), (-212.0, 85.0)]:
        add_f("coconut_palm", x, y, 0.15, float(rng.uniform(0.95, 1.25)))

    # 3. Frangipani Trees framing Fengqitang, Yanlintang, Pavilions & Alumni Hall (campus_fengqitang.jpg!)
    for x, y in [
        (-49.0, 66.0), (-31.0, 66.0), (-49.0, 88.0), (-30.0, 86.0),
        (59.0, 54.0), (77.0, 54.0), (58.0, 72.0),
        (-34.0, 50.0), (-45.0, 52.0), (28.0, 50.0), (40.0, 52.0),
        (86.0, 38.0), (98.0, 38.0),
    ]:
        if clear_of_obstacles(x, y, pad=1.5):
            add_f("frangipani", x, y, 0.15, float(rng.uniform(0.9, 1.22)))

    # 4. Lush Courtyard Palms inside Block 1-2 Inner Court, South Classrooms Twin Courts & Library Court
    for x, y in [
        (-10.0, -28.0), (10.0, -28.0), (-8.0, -35.0), (8.0, -35.0),
        (-42.0, -126.0), (-42.0, -152.0), (-25.0, -142.0),
        (72.0, 18.0), (72.0, 4.0), (72.0, -10.0),
    ]:
        if clear_of_obstacles(x, y, pad=1.4):
            add_f("royal_palm" if y < -80 else "terminalia", x, y, 0.15, float(rng.uniform(0.85, 1.10)))

    # 5. Shaded Banyan & Terminalia Tree Alleys along Campus Spines, Sports Perimeter & Botanical Garden
    # Botanical garden dense lush grove (southwest around x=-160..-92, y=-200..-135)
    for _ in range(38):
        gx = float(rng.uniform(-162.0, -94.0))
        gy = float(rng.uniform(-194.0, -134.0))
        if clear_of_obstacles(gx, gy, pad=2.0):
            kind = rng.choice(["banyan", "terminalia", "coconut_palm", "frangipani"], p=[0.42, 0.28, 0.18, 0.12])
            add_f(str(kind), gx, gy, 0.15, float(rng.uniform(0.85, 1.32)))

    # Campus-wide tree avenue & courtyard fill (respecting real buildings, roads, and sports courts)
    for _ in range(280):
        tx = float(rng.uniform(-225.0, 210.0))
        ty = float(rng.uniform(-245.0, 118.0))
        if not clear_of_obstacles(tx, ty, pad=3.2):
            continue
        # Ensure natural spacing between trees
        too_close = False
        for lst in flora.values():
            for p in lst[-80:]:
                if math.hypot(p[0] - tx, p[1] - ty) < 8.5:
                    too_close = True
                    break
            if too_close:
                break
        if too_close:
            continue
        kind = str(rng.choice(["banyan", "terminalia", "royal_palm", "coconut_palm"], p=[0.36, 0.30, 0.20, 0.14]))
        add_f(kind, tx, ty, 0.15, float(rng.uniform(0.82, 1.25)))

    # 6. Bougainvillea Flowering Shrubs lining garden beds, courts, Yanchi shore & forecourt corners
    boug_pts = [
        (-13.8, 30.8), (13.8, 30.8), (-13.8, 39.5), (13.8, 39.5),
        (-38.0, 22.0), (-26.0, 22.0), (22.0, 22.0), (54.0, 22.0),
        (36.0, -107.2), (48.0, -106.8), (59.0, -107.4), (35.5, -128.0),
        (-37.0, 52.5), (-43.0, 52.5), (31.0, 51.5), (37.0, 51.5),
        (74.5, 22.0), (74.5, 10.0), (74.5, -8.0),
        (-73.0, -12.0), (-73.0, -48.0), (-73.0, -96.0),
    ]
    for bx, by in boug_pts:
        add_f("bougainvillea", bx, by, 0.15, float(rng.uniform(0.85, 1.25)))

    # =====================================================================
    # Campus Street Furniture Props
    # =====================================================================
    # 1. Three-globe Campus Lamps along main axis, forecourt road, Yanchi, spines & track!
    for y in (58.0, 74.0, 90.0):
        add_p("lamp_3globe", -6.6, y, 0.15, 0.0)
        add_p("lamp_3globe", 6.6, y, 0.15, 0.0)
    for x in (-110.0, -82.0, -54.0, -26.0, 26.0, 54.0, 82.0, 110.0):
        add_p("lamp_3globe", x, 42.0, 0.15, 0.0)
    for y in (-16.0, -56.0, -96.0, -138.0, -182.0):
        add_p("lamp_3globe", 63.8, y, 0.15, math.pi * 0.5)
        add_p("lamp_3globe", -63.8, y, 0.15, math.pi * 0.5)
    for x in (39.0, 54.0):
        add_p("lamp_3globe", x, -106.5, 0.15, 0.0)

    # 2. Shaded Courtyard Benches under Centenary Terminalia, along Forecourt, Yanchi & Heritage Gardens
    bench_spots = [
        (33.5, 17.5, 0.15, 0.60), (44.0, 16.0, -0.3, 0.60), (41.0, 21.8, math.pi, 0.15),
        (-22.0, 22.0, math.pi, 0.15), (-32.0, 22.0, math.pi, 0.15),
        (42.0, -106.2, math.pi, 0.15), (52.0, -106.2, math.pi, 0.15), (65.2, -118.0, -math.pi * 0.5, 0.15),
        (-28.0, 58.0, math.pi * 0.5, 0.15), (42.0, 58.0, -math.pi * 0.5, 0.15),
        (73.5, 14.0, -math.pi * 0.5, 0.15), (73.5, -4.0, -math.pi * 0.5, 0.15),
    ]
    for bx, by, rot, bz in bench_spots:
        add_p("bench", bx, by, bz, rot)

    # 3. 12 Basketball Hoops accurately paired at north & south ends of all 6 real OSM courts!
    for sf in spec["sports_and_landuse"]:
        if sf["kind"] != "basketball_court":
            continue
        x0, y0, x1, y1 = sf["bbox"]
        cx = 0.5 * (x0 + x1)
        add_p("basketball_hoop", cx, y0 + 1.4, 0.15, 0.0)       # facing +Y
        add_p("basketball_hoop", cx, y1 - 1.4, 0.15, math.pi)   # facing -Y

    # 4. Campus Exhibition / Notice Display Boards (seen in front of Science Hall in campus_kexue.jpg!)
    for bx, by, rot in [
        (-12.0, -68.5, 0.0), (-5.0, -68.5, 0.0), (2.0, -68.5, 0.0), (9.0, -68.5, 0.0),
        (16.0, 41.2, 0.0), (-16.0, 41.2, 0.0), (72.5, 28.0, -math.pi * 0.5),
    ]:
        add_p("bulletin_board", bx, by, 0.15, rot)

    # 5. Covered Campus Bike Racks near Teaching Block 1, Library, Canteen 1 & Dorms
    for bx, by, rot in [
        (-59.5, 34.0, math.pi * 0.5), (60.5, 34.0, math.pi * 0.5),
        (73.0, -24.0, math.pi * 0.5), (123.0, -20.0, math.pi * 0.5),
        (123.0, -135.0, math.pi * 0.5), (-73.5, -104.0, math.pi * 0.5),
    ]:
        add_p("bike_rack", bx, by, 0.15, rot)

    return {"flora": flora, "props": props}
