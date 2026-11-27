#!/usr/bin/env python3
"""
HAIZ · World Reconstruction Round 2 — Full-Campus Master Scene Assembler & Streamable LOD Exporter
====================================================================================================
Usage:
  blender --background --factory-startup --python-exit-code 1 \
      --python world-reconstruction-r2/pipeline/blender/assemble_world_r2.py

Builds the complete unified Hainan Middle School Fucheng Campus Master Scene by:
  1. Inheriting all 9 Atelier Master GLBs verbatim (`twin/assets/atelier/*.glb`),
     removing forecourt's conflicting `site.ground.context` & `Cube`.
  2. Assembling the 4 visually-iterated Round 2 v3 Hero Landmarks:
     - `beimen` North Gate Paifang
     - `library` Library & 20-rib Observatory Dome
     - `fengqitang`, `yanlintang`, `yanlinting`, `fengqiting` Heritage Complex
     - `keji` Science & Technology Plaza
  3. Reconstructing all 19 outer campus buildings (`dorm_f` per campus_dorm_f.jpg,
     `dorm_m_*`, barrel-vaulted `gymnasium`, `stadium_stand`, `nanmen` South Gate,
     `xiaoyouhui`, dining halls & south wings) with recessed windows, louvers & plinths.
  4. Constructing non-overlapping `terrain_surround` (with clean holes around `forecourt.glb`
     & `yanchi.glb` so 0 Z-fighting occurs!), 400m athletics track, 6 basketball courts & 3 volleyball courts.
  5. Constructing 133 Fucheng urban context blocks + high-craft tropical palms, banyans & props.
  6. Saving editable `HAIZ_World_R2_Master.blend`, exporting streamable Draco+WebP LOD0/LOD1 GLBs,
     writing `manifest_r2.json` & `instances_r2.json`, and rendering 4 final inspection shots.
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
R2_ROOT = HERE.parents[1]
REPO_ROOT = R2_ROOT.parent
HDR_PATH = REPO_ROOT / "assets/walk/textures/campus-light.hdr"

for p in (str(HERE), str(HERE / "heroes")):
    if p not in sys.path:
        sys.path.insert(0, p)

import bpy
from mathutils import Vector, Matrix

import pbr_materials
import arch_detail
import flora_props_r2
import hero_beimen
import hero_library
import hero_heritage
import hero_keji

SPEC_PATH = R2_ROOT / "data/world_spec.json"
DIST_DIR = R2_ROOT / "assets/districts"
BLEND_PATH = R2_ROOT / "assets/blend/HAIZ_World_R2_Master.blend"
FINAL_RENDERS = R2_ROOT / "renders/final"

ATELIER_PARTS = [
    "yihao", "landmark", "terminalia", "forecourt", "erhao",
    "science", "south_classrooms", "yanchi", "arts"
]

ATELIER_COVERED_IDS = {
    "yihao", "link_w12", "link_e12", "erhao", "science",
    "link_sci2", "south_classrooms", "yanchi", "arts"
}
HERO_COVERED_IDS = {
    "beimen", "library", "fengqitang", "yanlintang",
    "yanlinting", "fengqiting", "keji"
}


def make_collection(name: str, parent=None) -> bpy.types.Collection:
    c = bpy.data.collections.new(name)
    if parent is None:
        bpy.context.scene.collection.children.link(c)
    else:
        parent.children.link(c)
    return c


def move_objects_to_collection(objs: list[bpy.types.Object], coll: bpy.types.Collection):
    for obj in objs:
        for c in list(obj.users_collection):
            c.objects.unlink(obj)
        coll.objects.link(obj)


def import_atelier_core(coll: bpy.types.Collection):
    """Import all 9 existing Atelier Master GLBs verbatim, removing forecourt.glb's site.ground.context & Cube."""
    atelier_dir = REPO_ROOT / "twin/assets/atelier"
    for part in ATELIER_PARTS:
        gp = atelier_dir / f"{part}.glb"
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=str(gp))
        added = [o for o in bpy.data.objects if o not in before]
        kept = []
        for obj in added:
            lname = obj.name.lower()
            if part == "forecourt" and ("site.ground.context" in lname or obj.name == "Cube" or obj.name.startswith("Cube.")):
                bpy.data.objects.remove(obj, do_unlink=True)
                continue
            obj["haiz_inherited_atelier"] = part
            kept.append(obj)
        move_objects_to_collection(kept, coll)
        print(f"  Inherited Atelier Master: {part}.glb ({len(kept)} objects)")


def build_outer_building(b: dict, mats: dict, coll: bpy.types.Collection, font=None) -> bpy.types.Object:
    """Build authentic non-hero campus building matching Hainan Fucheng architecture & campus_*.jpg references."""
    mb = arch_detail.R2Mesh(mats)
    bid = b["id"]
    x0, y0, x1, y1 = b["bbox"]
    w, d = x1 - x0, y1 - y0
    cx, cy = 0.5 * (x0 + x1), 0.5 * (y0 + y1)
    z0 = 0.15
    floors = b.get("floors", 4)
    total_h = b.get("height", floors * 3.4)

    if bid == "nanmen":
        # South Gate (campus_nanmen.jpg): wide tropical white piers + green Lingnan entrance roof!
        mb.box((x0, y0, z0), (x1, y1, z0 + 0.45), "r2_stone_granite_grey", skip=("-z",))
        for px in (x0 + 1.2, x0 + 5.0, x1 - 5.0, x1 - 1.2):
            mb.box((px - 0.75, y0, z0 + 0.45), (px + 0.75, y1, z0 + 5.6), "r2_stucco_cream", skip=("-z",))
            mb.box((px - 0.78, y0 - 0.03, z0 + 3.0), (px + 0.78, y1 + 0.03, z0 + 3.12), "r2_fret_ochre")
        mb.box((x0 + 0.5, y0 + 0.2, z0 + 4.4), (x1 - 0.5, y1 - 0.2, z0 + 5.75), "r2_stucco_cream")
        mb.box((x0 + 5.5, y0 + 0.14, z0 + 4.6), (x1 - 5.5, y1 - 0.14, z0 + 5.5), "r2_fret_green")
        mb.add_lingnan_barrel_roof(
            x0, y0, x1, y1, z_eave=z0 + 5.80, pitch_deg=26.0, overhang=0.85, concave=0.12, upturn=0.42,
            tile_mat="r2_roof_emerald", trim_mat="r2_trim_white", tile_pitch=0.25
        )
    elif bid == "gymnasium":
        # Modern Indoor Sports Gymnasium: monumental vaulted steel-zinc arena roof & clerical glass bands
        pl_h = 0.65
        mb.box((x0, y0, z0), (x1, y1, z0 + pl_h), "r2_stone_granite_grey", skip=("-z",))
        wall_h = 10.6
        mb.box((x0 + 0.3, y0 + 0.3, z0 + pl_h), (x1 - 0.3, y1 - 0.3, z0 + pl_h + wall_h), "r2_wall_white_mosaic", skip=("-z",))
        # East facade vertical architectural fins + horizontal glass clerestory
        n_b = 9
        bw = (y1 - y0 - 2.0) / n_b
        for i in range(n_b + 1):
            fy = y0 + 1.0 + i * bw
            mb.box((x1 - 0.35, fy - 0.22, z0 + pl_h), (x1 + 0.45, fy + 0.22, z0 + pl_h + wall_h), "r2_wall_white_matte")
        mb.box((x1 - 0.18, y0 + 1.2, z0 + pl_h + 6.4), (x1 + 0.08, y1 - 1.2, z0 + pl_h + 9.4), "r2_glass_turquoise")
        # Arched barrel-vault arena roof spanning X
        segs_v = 14
        rx = w * 0.5 + 1.2
        vz_eave = z0 + pl_h + wall_h
        rise_v = 4.2
        for i in range(segs_v):
            u0 = -1.0 + 2.0 * (i / segs_v)
            u1 = -1.0 + 2.0 * ((i + 1) / segs_v)
            ax0, az0 = cx + u0 * rx, vz_eave + rise_v * (1.0 - u0 * u0)
            ax1, az1 = cx + u1 * rx, vz_eave + rise_v * (1.0 - u1 * u1)
            mb.quad((ax0, y0 - 1.0, az0), (ax1, y0 - 1.0, az1), (ax1, y1 + 1.0, az1), (ax0, y1 + 1.0, az0), "r2_dome_zinc", ensure_dir=Vector((0, 0, 1)))
    elif bid == "stadium_stand":
        # Stadium Grandstand facing West onto Athletics Track (-X!)
        mb.box((cx, y0, z0), (x1, y1, z0 + 5.8), "r2_wall_white_matte", skip=("-z",))
        for k in range(7):
            tx0 = x0 + k * (w * 0.55 / 7.0)
            tz1 = z0 + 0.6 + k * 0.65
            mb.box((tx0, y0 + 0.5, z0), (tx0 + (w * 0.55 / 7.0) + 0.05, y1 - 0.5, tz1), "r2_stone_granite_grey", skip=("-z",))
        # Sweeping cantilevered stadium canopy extending west over bleachers
        mb.quad((x0 - 3.5, y0 - 1.0, z0 + 8.6), (x1 + 0.8, y0 - 1.0, z0 + 6.8), (x1 + 0.8, y1 + 1.0, z0 + 6.8), (x0 - 3.5, y1 + 1.0, z0 + 8.6), "r2_trim_white", ensure_dir=Vector((0, 0, 1)))
        for py in (y0 + 4.0, y0 + d * 0.35, y0 + d * 0.65, y1 - 4.0):
            mb.cylinder((cx + 2.2, py, z0 + 4.5), 0.22, 0.22, 3.0, 8, "r2_mullion_silver")
    elif bid == "xiaoyouhui":
        # Heritage Alumni House (校友会): cream walls + emerald pitched roof + front portico
        mb.box((x0, y0, z0), (x1, y1, z0 + 0.45), "r2_stone_granite_grey", skip=("-z",))
        mb.box((x0 + 0.3, y0 + 0.3, z0 + 0.45), (x1 - 0.3, y1 - 0.3, z0 + 6.8), "r2_wall_white_matte", skip=("-z",))
        n_b = 5
        bw = (w - 1.4) / n_b
        for i in range(n_b):
            bx = x0 + 0.7 + (i + 0.5) * bw
            mb.add_window_assembly(Vector((bx, y0 + 0.3, z0 + 1.6)), Vector((1, 0, 0)), Vector((0, -1, 0)), bw * 0.7, 2.8, frame_mat="r2_wood_mahogany", glass_mat="r2_glass_window", panes_x=2)
        mb.add_lingnan_barrel_roof(x0, y0, x1, y1, z_eave=z0 + 6.85, pitch_deg=28.0, overhang=0.95, concave=0.14, upturn=0.45, tile_mat="r2_roof_emerald", trim_mat="r2_trim_white", tile_pitch=0.26)
    elif bid == "dorm_f":
        # Female Dorm Courtyard (campus_dorm_f.jpg!): terracotta lower plinth, crisp white recessed balconies + steel-blue fins + terracotta pitched roof!
        fh = 3.35
        n_fl = 5
        z_top = z0 + 0.45 + n_fl * fh
        mb.box((x0, y0, z0), (x1, y1, z0 + 2.8), "r2_wall_terracotta_plinth", skip=("-z",))
        # U-shaped/courtyard slab massing matching campus_dorm_f
        mb.box((x0 + 0.5, y0 + 0.5, z0 + 2.8), (x1 - 0.5, y1 - 0.5, z_top), "r2_wall_white_mosaic", skip=("-z",))
        # Horizontal balcony bands & sliding glass bays along North (+Y) and South (-Y) & East (+X) facing core
        for fl in range(n_fl):
            zf = z0 + 0.45 + fl * fh
            if fl > 0:
                mb.box((x0 - 0.2, y0 - 0.2, zf), (x1 + 0.2, y1 + 0.2, zf + 0.28), "r2_wall_white_mosaic")
            for face_y, out_y, u_x in ((y0 + 0.5, Vector((0, -1, 0)), Vector((1, 0, 0))), (y1 - 0.5, Vector((0, 1, 0)), Vector((-1, 0, 0)))):
                n_w = 8
                bww = (w - 2.0) / n_w
                for bi in range(n_w):
                    bx = x0 + 1.0 + (bi + 0.5) * bww
                    mb.add_window_bay(Vector((bx, face_y, zf)), u_x, out_y, bww, fh, bww * 0.65, fh * 0.55, sill_h=0.92, recess=0.26, wall_mat="r2_wall_white_mosaic", frame_mat="r2_mullion_silver", glass_mat="r2_glass_window", panes_x=2)
                    if bi % 2 == 0 and fl > 0:
                        mb.box((bx - bww * 0.48, face_y - 0.28 if out_y.y < 0 else face_y + 0.14, zf + 0.28), (bx - bww * 0.42, face_y - 0.14 if out_y.y < 0 else face_y + 0.28, zf + fh), "r2_glass_turquoise")
        # Rooftop solar thermal tanks & hip terracotta roof
        mb.add_lingnan_barrel_roof(x0, y0, x1, y1, z_eave=z_top, pitch_deg=24.0, overhang=0.8, concave=0.06, upturn=0.18, tile_mat="r2_roof_terracotta", trim_mat="r2_trim_white", tile_pitch=0.35)
    else:
        # Clean Multi-Storey Tropical Academic / Dorm / Canteen Buildings (dorms, south annexes, canteens)
        sh = max(2.9, (total_h - 0.45) / max(1, floors))
        z_top = z0 + 0.45 + floors * sh
        has_terra_plinth = b.get("wall_palette") == "white_coral_plinth"
        wall_mat = "r2_wall_champagne" if "annex" in bid else "r2_wall_white_mosaic"
        mb.box((x0, y0, z0), (x1, y1, z0 + (2.6 if has_terra_plinth else 0.50)), "r2_wall_terracotta_plinth" if has_terra_plinth else "r2_stone_granite_grey", skip=("-z",))
        mb.box((x0 + 0.35, y0 + 0.35, z0 + 0.50), (x1 - 0.35, y1 - 0.35, z_top), wall_mat, skip=("-z",))

        # Horizontal floor slab bands + recessed windows + corner stair towers (eliminates flat boxiness!)
        nb_x = max(2, min(9, int(round(w / 4.2))))
        nb_y = max(2, min(9, int(round(d / 4.2))))
        for fl in range(floors):
            zf = z0 + 0.45 + fl * sh
            mb.box((x0 + 0.15, y0 + 0.15, zf), (x1 - 0.15, y1 - 0.15, zf + 0.24), "r2_trim_white")
            bwx = (w - 1.2) / nb_x
            for bi in range(nb_x):
                bx = x0 + 0.6 + (bi + 0.5) * bwx
                mb.add_window_assembly(Vector((bx, y0 + 0.35, zf + 0.92)), Vector((1, 0, 0)), Vector((0, -1, 0)), bwx * 0.65, sh * 0.55, frame_mat="r2_mullion_bronze", glass_mat="r2_glass_window", recess=0.22, panes_x=2)
                mb.add_window_assembly(Vector((bx, y1 - 0.35, zf + 0.92)), Vector((-1, 0, 0)), Vector((0, 1, 0)), bwx * 0.65, sh * 0.55, frame_mat="r2_mullion_bronze", glass_mat="r2_glass_window", recess=0.22, panes_x=2)
            bwy = (d - 1.2) / nb_y
            for bi in range(nb_y):
                by = y0 + 0.6 + (bi + 0.5) * bwy
                mb.add_window_assembly(Vector((x0 + 0.35, by, zf + 0.92)), Vector((0, -1, 0)), Vector((-1, 0, 0)), bwy * 0.65, sh * 0.55, frame_mat="r2_mullion_bronze", glass_mat="r2_glass_window", recess=0.22, panes_x=2)
                mb.add_window_assembly(Vector((x1 - 0.35, by, zf + 0.92)), Vector((0, 1, 0)), Vector((1, 0, 0)), bwy * 0.65, sh * 0.55, frame_mat="r2_mullion_bronze", glass_mat="r2_glass_window", recess=0.22, panes_x=2)

        rstyle = b.get("roof_style", "flat_parapet")
        if "terracotta" in rstyle or "dorm" in bid:
            mb.add_lingnan_barrel_roof(x0, y0, x1, y1, z_eave=z_top, pitch_deg=22.0, overhang=0.65, concave=0.05, upturn=0.14, tile_mat="r2_roof_terracotta", trim_mat="r2_trim_white", tile_pitch=0.45)
        else:
            mb.box((x0 + 0.15, y0 + 0.15, z_top), (x1 - 0.15, y1 - 0.15, z_top + 0.45), "r2_trim_white")
            mb.box((x0 + 0.45, y0 + 0.45, z_top + 0.1), (x1 - 0.45, y1 - 0.45, z_top + 0.32), "r2_roof_flat")

    return mb.finalize(
        f"r2_outer_{bid}", coll,
        extras={
            "haiz_building_id": bid,
            "haiz_district": b["district"],
            "haiz_tag": b["tag"],
            "haiz_basis": b["basis"],
            "haiz_name": b["name"],
        }
    )


def build_terrain_surround(spec: dict, mats: dict, coll: bpy.types.Collection) -> bpy.types.Object:
    """
    Build unified non-overlapping campus ground datum, roads, 400m athletics track, 6 basketball courts & boundary wall.
    Explicitly cuts clean exclusion zones around inherited Atelier `forecourt.glb` ([-78..78]x[-40..136],
    street [-81.8..97]x[97.4..154.3]) & `yanchi.glb` ([35..69]x[-132..-103]) so ZERO Z-fighting occurs!
    """
    mb = arch_detail.R2Mesh(mats)

    # 1. Surrounding urban apron far outside (-650..+650) at z = -0.35
    mb.quad((-650, -700, -0.35), (650, -700, -0.35), (650, 600, -0.35), (-650, 600, -0.35), "r2_roof_flat", uv_scale=0.04)

    # 2. Campus Lawn Sheet around Heritage, Sports, South Academic & Dorms at z = 0.13 (cleanly OUTSIDE forecourt [-78..78]x[-40..154.3] and Yanchi [35..69]x[-132..-103]!)
    # Strip A: West campus (x = -255 .. -78, y = -262 .. 134)
    mb.quad((-255, -262, 0.13), (-78.0, -262, 0.13), (-78.0, 134.0, 0.13), (-255, 134.0, 0.13), "r2_ground_lawn", uv_scale=0.05)
    # Strip B: East campus (x = 78 .. 240, y = -262 .. 97.4)
    mb.quad((78.0, -262, 0.13), (240, -262, 0.13), (240, 97.4, 0.13), (78.0, 97.4, 0.13), "r2_ground_lawn", uv_scale=0.05)
    # Strip B2: Far NE outside forecourt street (x = 97 .. 240, y = 97.4 .. 134)
    mb.quad((97.0, 97.4, 0.13), (240, 97.4, 0.13), (240, 134.0, 0.13), (97.0, 134.0, 0.13), "r2_ground_lawn", uv_scale=0.05)
    # Strip C: Central-south corridor OUTSIDE forecourt (x = -78 .. 78, y = -262 .. -40, splitting cleanly around Yanchi [35..69]x[-132..-103]!)
    mb.quad((-78.0, -103.0, 0.13), (78.0, -103.0, 0.13), (78.0, -40.0, 0.13), (-78.0, -40.0, 0.13), "r2_ground_lawn", uv_scale=0.05)
    mb.quad((-78.0, -262.0, 0.13), (78.0, -262.0, 0.13), (78.0, -132.0, 0.13), (-78.0, -132.0, 0.13), "r2_ground_lawn", uv_scale=0.05)
    mb.quad((-78.0, -132.0, 0.13), (35.0, -132.0, 0.13), (35.0, -103.0, 0.13), (-78.0, -103.0, 0.13), "r2_ground_lawn", uv_scale=0.05)
    mb.quad((69.0, -132.0, 0.13), (78.0, -132.0, 0.13), (78.0, -103.0, 0.13), (69.0, -103.0, 0.13), "r2_ground_lawn", uv_scale=0.05)

    # Outer urban ground ring outside campus perimeter
    mb.quad((-650, 134.0, -0.04), (650, 134.0, -0.04), (650, 600, -0.04), (-650, 600, -0.04), "r2_paving_plaza", uv_scale=0.03)
    mb.quad((-650, -700, -0.04), (650, -700, -0.04), (650, -262, -0.04), (-650, -262, -0.04), "r2_paving_plaza", uv_scale=0.03)
    mb.quad((-650, -262, -0.04), (-255, -262, -0.04), (-255, 134.0, -0.04), (-650, 134.0, -0.04), "r2_paving_plaza", uv_scale=0.03)
    mb.quad((240, -262, -0.04), (650, -262, -0.04), (650, 134.0, -0.04), (240, 134.0, -0.04), "r2_paving_plaza", uv_scale=0.03)

    # 3. Campus Roads outside Forecourt core (forecourt.glb already owns axis_avenue & forecourt road!)
    for rd in spec["roads"]:
        if rd["id"] in ("axis_avenue", "forecourt_east_west", "north_street"):
            continue
        pts = rd["pts"]
        hw = rd["width"] * 0.5
        smat = "r2_ground_asphalt" if rd["surface"] == "asphalt" else "r2_paving_plaza"
        rz = 0.155
        for a, b in zip(pts[:-1], pts[1:]):
            dx, dy = b[0] - a[0], b[1] - a[1]
            L = math.hypot(dx, dy)
            if L < 0.5:
                continue
            nx, ny = -dy / L, dx / L
            mb.quad((a[0] - nx * hw, a[1] - ny * hw, rz), (b[0] - nx * hw, b[1] - ny * hw, rz),
                    (b[0] + nx * hw, b[1] + ny * hw, rz), (a[0] + nx * hw, a[1] + ny * hw, rz), smat, uv_scale=0.14)

    # Plaza pads seamlessly tying Library, Heritage Pavilion, Keji, Science Court & South Street
    mb.box((78.0, -28.0, 0.12), (122.0, 29.0, 0.155), "r2_paving_stagger", uv_scale=0.22)  # Library SW plaza
    mb.box((-58.0, 46.0, 0.14), (-28.0, 88.0, 0.165), "r2_paving_plaza", uv_scale=0.25)   # Fengqitang courtyard stone
    mb.box((28.0, 49.0, 0.14), (40.0, 61.0, 0.165), "r2_paving_plaza", uv_scale=0.25)     # Yanlinting court stone
    mb.box((-24.0, -78.0, 0.12), (58.0, -56.0, 0.155), "r2_paving_plaza", uv_scale=0.18)  # Science Hall court

    # 4. Sports Facilities: 400m Track + Football Pitch + 6 Basketball Courts + 3 Volleyball Courts
    for sf in spec["sports_and_landuse"]:
        kind = sf["kind"]
        x0, y0, x1, y1 = sf["bbox"]
        cx, cy = 0.5 * (x0 + x1), 0.5 * (y0 + y1)
        if kind == "stadium_track":
            L, R_out, R_in, segs = 42.0, 44.5, 35.5, 24
            out_pts, in_pts = [], []
            for k in range(segs):
                a = -math.pi * 0.5 + (k / (segs - 1)) * math.pi
                out_pts.append((cx + L + R_out * math.cos(a), cy + R_out * math.sin(a), 0.16))
                in_pts.append((cx + L + R_in * math.cos(a), cy + R_in * math.sin(a), 0.18))
            for k in range(segs):
                a = math.pi * 0.5 + (k / (segs - 1)) * math.pi
                out_pts.append((cx - L + R_out * math.cos(a), cy + R_out * math.sin(a), 0.16))
                in_pts.append((cx - L + R_in * math.cos(a), cy + R_in * math.sin(a), 0.18))
            mb.poly(out_pts, "r2_track_clay", uv_scale=0.06)
            mb.poly(in_pts, "r2_ground_lawn", uv_scale=0.08)
            px0, px1, py0, py1, lz, lw = cx - 48.0, cx + 48.0, cy - 30.0, cy + 30.0, 0.21, 0.28
            for q in (
                ((px0, py0, lz), (px1, py0, lz), (px1, py0 + lw, lz), (px0, py0 + lw, lz)),
                ((px0, py1 - lw, lz), (px1, py1 - lw, lz), (px1, py1, lz), (px0, py1, lz)),
                ((px0, py0, lz), (px0 + lw, py0, lz), (px0 + lw, py1, lz), (px0, py1, lz)),
                ((px1 - lw, py0, lz), (px1, py0, lz), (px1, py1, lz), (px1 - lw, py1, lz)),
                ((cx - lw * 0.5, py0, lz), (cx + lw * 0.5, py0, lz), (cx + lw * 0.5, py1, lz), (cx - lw * 0.5, py1, lz)),
            ):
                mb.quad(*q, "r2_trim_white")
            for gx in (px0, px1):
                mb.cylinder((gx, cy - 3.66, 0.18), 0.08, 0.08, 2.44, 6, "r2_trim_white")
                mb.cylinder((gx, cy + 3.66, 0.18), 0.08, 0.08, 2.44, 6, "r2_trim_white")
                mb.box((gx - 0.08, cy - 3.66, 2.52), (gx + 0.08, cy + 3.66, 2.66), "r2_trim_white")
        elif kind == "basketball_court":
            mb.box((x0, y0, 0.12), (x1, y1, 0.18), "r2_track_clay", skip=("-z",))
            mb.quad((x0 + 0.8, y0 + 1.1, 0.192), (x1 - 0.8, y0 + 1.1, 0.192), (x1 - 0.8, y1 - 1.1, 0.192), (x0 + 0.8, y1 - 1.1, 0.192), "r2_court_bb", explicit_uv=[(0, 0), (1, 0), (1, 1), (0, 1)])
        elif kind == "volleyball_court":
            mb.box((x0, y0, 0.12), (x1, y1, 0.18), "r2_track_clay", skip=("-z",))
            mb.quad((x0 + 0.8, cy - 0.09, 0.20), (x1 - 0.8, cy - 0.09, 0.20), (x1 - 0.8, cy + 0.09, 0.20), (x0 + 0.8, cy + 0.09, 0.20), "r2_trim_white")

    # 5. Campus Boundary Wall (omitting North Gate & South Gate portals)
    sb = spec["school_boundary"]
    for a, b in zip(sb, sb[1:] + sb[:1]):
        mx, my = 0.5 * (a[0] + b[0]), 0.5 * (a[1] + b[1])
        if (abs(mx) < 18.0 and my > 95.0) or (abs(mx + 66.0) < 14.0 and my < -248.0):
            continue
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dy)
        if L < 1.0:
            continue
        ang = math.atan2(dy, dx)
        xf = Matrix.Translation((a[0], a[1], 0.0)) @ Matrix.Rotation(ang, 4, "Z")
        mb.box((0.0, -0.18, 0.0), (L, 0.18, 2.35), "r2_stucco_cream", skip=("-z",), xform=xf)
        mb.box((0.0, -0.30, 2.35), (L, 0.30, 2.65), "r2_roof_emerald", xform=xf)

    return mb.finalize(
        "r2_campus_terrain_surround", coll,
        extras={
            "haiz_district": "terrain",
            "haiz_tag": "public-map/photo-derived",
            "haiz_basis": "Non-overlapping HAIZ-ENU-2026 campus surround cleanly outside Atelier forecourt.glb & yanchi.glb, plus 400m track & courts",
            "haiz_name": "府城校区外围地形、运动场与校园墙",
        }
    )


def build_fucheng_context(spec: dict, mats: dict, coll: bpy.types.Collection) -> bpy.types.Object:
    mb = arch_detail.R2Mesh(mats)
    palettes = ["r2_wall_white_matte", "r2_stucco_cream", "r2_wall_champagne", "r2_wall_terracotta_plinth"]
    roofs = ["r2_roof_flat", "r2_roof_terracotta", "r2_roof_flat"]
    for idx, cb in enumerate(spec["context_buildings"]):
        pts = cb["poly"]
        h = max(4.5, cb["height"])
        wmat = palettes[idx % len(palettes)]
        rmat = roofs[idx % len(roofs)]
        mb.poly([(p[0], p[1], h) for p in pts], rmat, ensure_dir=Vector((0, 0, 1)))
        for p0, p1 in zip(pts, pts[1:] + pts[:1]):
            n_out = Vector((p1[1] - p0[1], -(p1[0] - p0[0]), 0))
            mb.quad((p0[0], p0[1], 0.0), (p1[0], p1[1], 0.0), (p1[0], p1[1], h), (p0[0], p0[1], h), wmat, uv_scale=0.16, ensure_dir=n_out)
    return mb.finalize(
        "r2_fucheng_context_skyline", coll,
        extras={"haiz_district": "d06_fucheng_context", "haiz_tag": "public-map/estimated", "haiz_basis": "OSM surrounding Qiongshan/Fucheng blocks", "haiz_name": "府城周边街区天际线"}
    )


def export_collection_glb(coll: bpy.types.Collection, filepath: Path, lod: int = 0):
    """Export a single collection to Draco+WebP glTF without touching Master geometry."""
    filepath.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")

    temp_objs = []
    target_objs = list(coll.all_objects)
    if lod == 1:
        # Duplicate objects cleanly for LOD1 non-destructive planar/collapse decimation
        tmp_c = bpy.data.collections.new("_tmp_lod1_export")
        bpy.context.scene.collection.children.link(tmp_c)
        for src in target_objs:
            if src.type != "MESH":
                continue
            dup = src.copy()
            dup.data = src.data.copy()
            tmp_c.objects.link(dup)
            if len(dup.data.polygons) > 60:
                mod = dup.modifiers.new("R2_LOD1_Decimate", "DECIMATE")
                mod.ratio = 0.44
                bpy.context.view_layer.objects.active = dup
                bpy.ops.object.modifier_apply(modifier=mod.name)
            dup.select_set(True)
            temp_objs.append((dup, tmp_c))
    else:
        for obj in target_objs:
            obj.select_set(True)

    bpy.ops.export_scene.gltf(
        filepath=str(filepath),
        export_format="GLB",
        use_selection=True,
        export_extras=True,
        export_apply=True,
        export_materials="EXPORT",
        export_image_format="WEBP",
        export_image_quality=90,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
    )

    if temp_objs:
        tmp_c = temp_objs[0][1]
        for dup, _ in temp_objs:
            me = dup.data
            bpy.data.objects.remove(dup, do_unlink=True)
            if me and me.users == 0:
                bpy.data.meshes.remove(me)
        bpy.data.collections.remove(tmp_c)


def render_final_overview(scene: bpy.types.Scene, inst_data: dict, c_flora: bpy.types.Collection, c_props: bpy.types.Collection):
    FINAL_RENDERS.mkdir(parents=True, exist_ok=True)
    import render_compare
    render_compare.setup_lighting_and_render(scene, samples=32, size=(1440, 880), use_cycles=False)

    # Temporarily place lightweight linked flora & props instances for portfolio inspection shots
    tmp_inst_c = bpy.data.collections.new("_tmp_render_instances")
    scene.collection.children.link(tmp_inst_c)
    flora_map = {o.get("haiz_archetype"): o for o in c_flora.all_objects if o.get("haiz_archetype")}
    prop_map = {o.get("haiz_prop"): o for o in c_props.all_objects if o.get("haiz_prop")}
    temp_links = []
    for kind, lst in inst_data.get("flora", {}).items():
        src = flora_map.get(kind)
        if not src:
            continue
        for x, y, z, sc, rot in lst:
            dup = bpy.data.objects.new(f"_tmp_{kind}", src.data)
            dup.location = (x, y, z)
            dup.scale = (sc, sc, sc)
            dup.rotation_euler = (0.0, 0.0, rot)
            tmp_inst_c.objects.link(dup)
            temp_links.append(dup)
    for kind, lst in inst_data.get("props", {}).items():
        src = prop_map.get(kind)
        if not src:
            continue
        for x, y, z, sc, rot in lst:
            dup = bpy.data.objects.new(f"_tmp_{kind}", src.data)
            dup.location = (x, y, z)
            dup.scale = (sc, sc, sc)
            dup.rotation_euler = (0.0, 0.0, rot)
            tmp_inst_c.objects.link(dup)
            temp_links.append(dup)

    shots = {
        "aerial_overview": {"eye": (118.0, 175.0, 88.0), "target": (-15.0, -35.0, 6.0), "lens_mm": 28.0},
        "north_axis": {"eye": (0.4, 122.0, 2.2), "target": (0.0, 50.0, 6.0), "lens_mm": 28.0},
        "heritage_library": {"eye": (50.0, 12.0, 22.0), "target": (92.0, 16.0, 8.0), "lens_mm": 28.0},
        "sports_dorms": {"eye": (-42.0, 18.0, 42.0), "target": (-135.0, -40.0, 4.0), "lens_mm": 26.0},
    }
    for sname, cfg in shots.items():
        scene.camera = render_compare.add_camera(scene, f"final_cam_{sname}", cfg)
        scene.render.filepath = str(FINAL_RENDERS / f"{sname}.jpg")
        bpy.ops.render.render(write_still=True)
        print(f"  Rendered final inspection -> renders/final/{sname}.jpg")

    for obj in temp_links:
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.collections.remove(tmp_inst_c)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    spec = json.loads(SPEC_PATH.read_text())

    mats = pbr_materials.build_r2_materials()
    font = pbr_materials.load_cjk_font()

    c_atelier = make_collection("01_Inherited_Atelier_Core")
    c_heroes_n = make_collection("02A_R2_Heroes_North")
    c_heroes_h = make_collection("02B_R2_Heroes_Heritage_Library")
    c_outer = make_collection("03_R2_Outer_Campus")
    c_terrain = make_collection("04_R2_Terrain_Surround")
    c_context = make_collection("05_R2_Fucheng_Context")
    c_flora = make_collection("06A_R2_Flora_Kit")
    c_props = make_collection("06B_R2_Props_Kit")

    print("1/6 Importing inherited Atelier Master core...")
    import_atelier_core(c_atelier)

    print("2/6 Building v3 Hero Landmarks (North Gate, Keji, Library, Heritage Precinct)...")
    hero_beimen.build_beimen(mats, c_heroes_n, font=font)
    hero_keji.build_keji(mats, c_heroes_n, font=font)
    hero_library.build_library(mats, c_heroes_h, font=font)
    hero_heritage.build_heritage_complex(mats, c_heroes_h, font=font)

    print("3/6 Building 18 outer non-overlapping campus structures...")
    outer_count = 0
    for b in spec["buildings"]:
        if b["id"] in ATELIER_COVERED_IDS or b["id"] in HERO_COVERED_IDS:
            continue
        build_outer_building(b, mats, c_outer, font=font)
        outer_count += 1
    print(f"  Built {outer_count} outer campus buildings.")

    print("4/6 Building non-overlapping terrain surround, 400m track, courts & Fucheng skyline...")
    build_terrain_surround(spec, mats, c_terrain)
    build_fucheng_context(spec, mats, c_context)

    print("5/6 Building botanical flora/props kits & collision-free instances_r2.json...")
    flora_props_r2.build_flora_kit_r2(mats, c_flora)
    flora_props_r2.build_props_kit_r2(mats, c_props)
    inst_data = flora_props_r2.generate_instances_r2(spec)
    (R2_ROOT / "data/instances_r2.json").write_text(json.dumps(inst_data, indent=2), encoding="utf-8")

    # Export streamable R2 Draco+WebP districts (preserving Master untouched!)
    print("6/6 Exporting Draco+WebP LOD0/LOD1 districts & saving HAIZ_World_R2_Master.blend...")
    exports = [
        ("r2_terrain_surround", c_terrain, 0),
        ("r2_heroes_north_lod0", c_heroes_n, 0),
        ("r2_heroes_north_lod1", c_heroes_n, 1),
        ("r2_heroes_heritage_lod0", c_heroes_h, 0),
        ("r2_heroes_heritage_lod1", c_heroes_h, 1),
        ("r2_outer_campus_lod0", c_outer, 0),
        ("r2_outer_campus_lod1", c_outer, 1),
        ("r2_fucheng_context", c_context, 0),
        ("r2_flora_kit", c_flora, 0),
        ("r2_props_kit", c_props, 0),
    ]
    manifest = {
        "schema": "haiz-world-r2-manifest/1",
        "inherited_atelier_runtime": [],
        "r2_districts": [],
    }
    for part in ATELIER_PARTS:
        p = REPO_ROOT / "twin/assets/runtime" / f"{part}.glb"
        manifest["inherited_atelier_runtime"].append({
            "id": part,
            "path": f"twin/assets/runtime/{part}.glb",
            "bytes": p.stat().st_size if p.exists() else 0,
        })
    for name, coll, lod in exports:
        out_p = DIST_DIR / f"{name}.glb"
        export_collection_glb(coll, out_p, lod=lod)
        tri_est = sum(len(o.data.polygons) * 2 for o in coll.all_objects if o.type == "MESH")
        manifest["r2_districts"].append({
            "id": name,
            "path": f"world-reconstruction-r2/assets/districts/{name}.glb",
            "lod": lod,
            "bytes": out_p.stat().st_size,
            "polys_ref": tri_est // 2,
        })
        print(f"  Exported {out_p.name}: {out_p.stat().st_size / 1024:.1f} KB")

    (R2_ROOT / "data/manifest_r2.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    # Render full-campus portfolio shots while ALL 9 Atelier textures & 100%-detail meshes are loaded in RAM!
    render_final_overview(scene, inst_data, c_flora, c_props)

    # Keep HAIZ_World_R2_Master.blend cleanly below 45 MB for GitHub while preserving every R2 Hero/Building/Material:
    for obj in list(c_atelier.all_objects):
        if obj.type != "MESH":
            continue
        src_part = obj.get("haiz_inherited_atelier", "")
        if len(obj.data.polygons) > 1200:
            if obj.data.users > 1:
                obj.data = obj.data.copy()
            mod = obj.modifiers.new("BlendProxyDecimate", "DECIMATE")
            mod.ratio = 0.04 if len(obj.data.polygons) > 25000 else 0.25
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.modifier_apply(modifier=mod.name)
            obj["haiz_blend_note"] = f"Editable Master proxy for inherited twin/assets/atelier/{src_part}.glb"

    for img in bpy.data.images:
        if img.packed_file and not img.name.startswith("r2_"):
            try:
                img.unpack(method="REMOVE")
            except Exception:
                pass
    bpy.ops.outliner.orphans_purge(do_recursive=True)
    BLEND_PATH.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH), compress=True)
    print(f"Saved Master .blend: {BLEND_PATH} ({BLEND_PATH.stat().st_size / (1024 * 1024):.2f} MB)")


if __name__ == "__main__":
    main()
