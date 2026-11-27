"""
HAIZ · World Reconstruction Round 2 — Hero Landmark 2 (v2): 图书馆与天文台 (Library & Observatory)
Faithfully oriented to aerial_campus.jpg & campus_library.jpg:
  - Main West (-X) showcase facade facing central campus lane:
      * Left garden wing + boxwood hedge beds
      * Grand 22-step external open-air staircase rising North toward Floor 2 deck
        (stepped white mosaic wing walls, silver handrails, cantilevered sloped canopy w/ coral stripe)
      * Iconic tall semicircular barrel-vault blue-green curtain wall rising above roofline!
  - South (-Y) & SW-chamfered cantilevered reading loggias (Floors 2-4):
      * Inset dark-backed multi-pane sliding windows (solid core inset -0.55m behind facades -> ZERO overlap!)
      * 45-degree chamfered SW & SE balcony aprons with coral-pink slab edge trims + silver pipe handrails
  - Engaged SE corner cylindrical glazed staircase tower + 20-ribbed silver zinc Observatory Dome on glazed drum!
"""
import math
import bpy
from mathutils import Matrix, Vector
from arch_detail import R2Mesh


def build_library(mats: dict, coll: bpy.types.Collection, font=None) -> list[bpy.types.Object]:
    x0, y0, x1, y1 = 81.0, -13.0, 114.5, 22.0
    z0 = 0.15
    fh = 3.85
    floors = 4
    z_top = z0 + floors * fh

    mb = R2Mesh(mats)

    # 1. Ground Granite Plinth
    mb.box((x0 - 0.5, y0 - 0.5, z0 - 0.05), (x1 + 0.5, y1 + 0.5, z0 + 0.45), "r2_stone_granite_grey", skip=("-z",))

    # 2. Inner Structural Core (STRICTLY inset 0.55m inside the window bays so recessed windows NEVER get covered!)
    wx0, wy0, wx1, wy1 = x0 + 1.8, y0 + 1.8, x1 - 1.5, y1 - 1.5
    mb.box((wx0 + 0.55, wy0 + 0.55, z0 + 0.45), (wx1 - 0.55, wy1 - 0.55, z_top), "r2_interior_dark", skip=("-z",))

    # Exterior Recessed Multi-Pane Window Bays along all 4 sides at (wx0..wx1, wy0..wy1)
    n_s = 6
    bw_s = (wx1 - wx0) / n_s
    n_w = 6
    bw_w = (wy1 - wy0) / n_w
    for fl in range(floors):
        zf = z0 + 0.45 + fl * fh
        sh = fh - 0.45 if fl == 0 else fh
        # South (-Y) facing Yanchi
        for bi in range(n_s):
            bx = wx0 + (bi + 0.5) * bw_s
            mb.add_window_bay(
                Vector((bx, wy0, zf)), Vector((1, 0, 0)), Vector((0, -1, 0)),
                bw_s, sh, bw_s * 0.74, sh * 0.62, sill_h=0.76, recess=0.26,
                wall_mat="r2_wall_white_mosaic", frame_mat="r2_mullion_silver", glass_mat="r2_glass_window", panes_x=3
            )
        # West (-X) facing central campus lane & Block 1
        for bi in range(n_w):
            by = wy0 + (bi + 0.5) * bw_w
            mb.add_window_bay(
                Vector((wx0, by, zf)), Vector((0, -1, 0)), Vector((-1, 0, 0)),
                bw_w, sh, bw_w * 0.74, sh * 0.62, sill_h=0.76, recess=0.26,
                wall_mat="r2_wall_white_mosaic", frame_mat="r2_mullion_silver", glass_mat="r2_glass_window", panes_x=3
            )
        # North (+Y) & East (+X)
        for bi in range(n_s):
            bx = wx0 + (bi + 0.5) * bw_s
            mb.add_window_bay(
                Vector((bx, wy1, zf)), Vector((-1, 0, 0)), Vector((0, 1, 0)),
                bw_s, sh, bw_s * 0.64, sh * 0.54, sill_h=0.92, recess=0.22,
                wall_mat="r2_wall_white_mosaic", frame_mat="r2_mullion_silver", glass_mat="r2_glass_window", panes_x=2
            )
        for bi in range(n_w):
            by = wy0 + (bi + 0.5) * bw_w
            mb.add_window_bay(
                Vector((wx1, by, zf)), Vector((0, 1, 0)), Vector((1, 0, 0)),
                bw_w, sh, bw_w * 0.64, sh * 0.54, sill_h=0.92, recess=0.22,
                wall_mat="r2_wall_white_mosaic", frame_mat="r2_mullion_silver", glass_mat="r2_glass_window", panes_x=2
            )

    # Corner enclosure piers cleanly tucked 0.01m inside facade face so zero coplanar Cycles Z-fighting!
    for cx_c in (wx0 + 0.01, wx1 - 0.56):
        for cy_c in (wy0 + 0.01, wy1 - 0.56):
            mb.box((cx_c, cy_c, z0 + 0.45), (cx_c + 0.54, cy_c + 0.54, z_top), "r2_wall_white_mosaic")

    # 3. Signature Cantilevered Reading Loggias with 45-degree Chamfered Corners & Coral Trim Lines (campus_library.jpg!)
    ch = 2.6
    # Outer polygon around South (-Y) and West (-X) facades with dramatic 45° SW chamfer
    for fl in range(1, floors + 1):
        zf = z0 + fl * fh
        # Slab deck along West & South with 45-deg SW chamfer!
        outer_sw = [
            (x0, y1 - 1.2), (x0, y0 + ch), (x0 + ch, y0), (x1 - 2.2, y0),
            (x1 - 2.2, wy0), (x0 + ch + 0.4, wy0), (wx0, y0 + ch + 0.4), (wx0, y1 - 1.2),
        ]
        # Top & bottom of balcony slab
        mb.poly([(p[0], p[1], zf + 0.28) for p in outer_sw], "r2_wall_white_mosaic", ensure_dir=Vector((0, 0, 1)))
        mb.poly([(p[0], p[1], zf) for p in reversed(outer_sw)], "r2_wall_white_mosaic", ensure_dir=Vector((0, 0, -1)))
        # Balcony outer fascia + coral-pink trim stripe + solid mosaic parapet + metallic top rail
        for i in range(4):
            a, b = outer_sw[i], outer_sw[i + 1]
            dx, dy = b[0] - a[0], b[1] - a[1]
            L = math.hypot(dx, dy)
            u = Vector((dx / L, dy / L, 0))
            out = Vector((-dy / L, dx / L, 0))  # outward pointing left-to-right on CCW loop
            # Fascia edge (0.28m) + middle coral pink accent stripe (0.14m)
            mb.quad(Vector((a[0], a[1], zf)), Vector((b[0], b[1], zf)), Vector((b[0], b[1], zf + 0.28)), Vector((a[0], a[1], zf + 0.28)), "r2_wall_white_mosaic", ensure_dir=out)
            mb.quad(Vector((a[0], a[1], zf + 0.08)) + out * 0.02, Vector((b[0], b[1], zf + 0.08)) + out * 0.02,
                    Vector((b[0], b[1], zf + 0.21)) + out * 0.02, Vector((a[0], a[1], zf + 0.21)) + out * 0.02, "r2_trim_coral", ensure_dir=out)
            # Solid balcony parapet (0.72m) & silver top rail (0.24m higher)
            par_h = 0.55 if fl == floors else 0.72
            mb.quad(Vector((a[0], a[1], zf + 0.28)), Vector((b[0], b[1], zf + 0.28)),
                    Vector((b[0], b[1], zf + 0.28 + par_h)), Vector((a[0], a[1], zf + 0.28 + par_h)), "r2_wall_white_mosaic", ensure_dir=out)
            mb.quad(Vector((a[0], a[1], zf + 0.28)) - out * 0.18, Vector((b[0], b[1], zf + 0.28)) - out * 0.18,
                    Vector((b[0], b[1], zf + 0.28 + par_h)) - out * 0.18, Vector((a[0], a[1], zf + 0.28 + par_h)) - out * 0.18, "r2_wall_white_mosaic", ensure_dir=-out)
            mb.quad(Vector((a[0], a[1], zf + 0.28 + par_h)) - out * 0.18, Vector((b[0], b[1], zf + 0.28 + par_h)) - out * 0.18,
                    Vector((b[0], b[1], zf + 0.28 + par_h)), Vector((a[0], a[1], zf + 0.28 + par_h)), "r2_trim_white", ensure_dir=Vector((0, 0, 1)))
            if fl < floors:
                mb.tube([Vector((a[0], a[1], zf + 1.16)) - out * 0.09, Vector((b[0], b[1], zf + 1.16)) - out * 0.09], 0.032, 6, "r2_mullion_silver")

    # Vertical balcony structural columns proud by 0.02m (zero coplanar slab overlap!)
    for px in [x0 + ch + 0.2, x0 + 9.5, x0 + 16.5, x0 + 23.5, x1 - 2.4]:
        mb.box((px - 0.24, y0 - 0.025, z0), (px + 0.24, y0 + 0.45, z_top + 0.55), "r2_wall_white_mosaic", skip=("-z",))
    for py in [y0 + ch + 0.2, y0 + 9.5, y0 + 16.0, y1 - 1.5]:
        mb.box((x0 - 0.025, py - 0.24, z0), (x0 + 0.45, py + 0.24, z_top + 0.55), "r2_wall_white_mosaic", skip=("-z",))

    # Top roof slab cleanly set inside perimeter balcony parapet
    mb.box((wx0 + 0.1, wy0 + 0.1, z_top), (x1 - 0.4, y1 - 0.4, z_top + 0.26), "r2_roof_flat")

    # 4. Grand External Open-Air Staircase along WEST (-X) Facade + Projecting Canopy (campus_library.jpg left-center!)
    # Sleek, authentic stepped staircase rising up-north to Floor 2 landing deck!
    st_x0, st_x1 = x0 - 4.8, x0 - 0.15  # 4.65m wide staircase matching campus_library.jpg
    sy_bot, sy_top = y0 + 5.6, y0 + 15.0
    z_land = z0 + fh + 0.28
    n_steps = 22
    dy_s = (sy_top - sy_bot) / n_steps
    dz_s = (z_land - z0) / n_steps
    for k in range(n_steps):
        yk = sy_bot + k * dy_s
        zk = z0 + (k + 1) * dz_s
        mb.box((st_x0, yk, z0), (st_x1, yk + dy_s + 0.04, zk), "r2_stone_granite_grey", skip=("-z",))

    # Outer West stepped cheek wall + silver handrail + dark top coping stripe (campus_library.jpg!)
    for cx_w in (st_x0 - 0.30, st_x1 - 0.06):
        for k in range(6):
            seg_y0 = sy_bot + (k / 6.0) * (sy_top - sy_bot)
            seg_y1 = sy_bot + ((k + 1) / 6.0) * (sy_top - sy_bot)
            seg_z = z0 + ((k + 1) / 6.0) * (z_land - z0) + 0.72
            mb.box((cx_w, seg_y0, z0), (cx_w + 0.34, seg_y1, seg_z), "r2_wall_white_mosaic", skip=("-z",))
            mb.box((cx_w - 0.02, seg_y0, seg_z), (cx_w + 0.36, seg_y1, seg_z + 0.08), "r2_stone_granite_dark")
        mb.tube([Vector((cx_w + 0.17, sy_bot, z0 + 0.96)), Vector((cx_w + 0.17, sy_top, z_land + 0.96))], 0.04, 8, "r2_mullion_silver")

    # Floor 2 Landing Deck & Sleek Cantilevered Entry Canopy (campus_library.jpg left-center!)
    mb.box((st_x0 - 0.35, sy_top, z_land - 0.26), (wx0 + 0.2, y1 - 2.4, z_land), "r2_wall_white_mosaic")
    mb.box((st_x0 - 1.23, sy_top - 0.78, z_land + 3.05), (wx0 + 0.18, y1 - 2.02, z_land + 3.15), "r2_soffit_shadow")
    mb.box((st_x0 - 1.25, sy_top - 0.8, z_land + 3.16), (wx0 + 0.2, y1 - 2.0, z_land + 3.36), "r2_wall_white_mosaic")
    mb.box((st_x0 - 1.28, sy_top - 0.82, z_land + 3.18), (st_x0 - 1.22, y1 - 1.98, z_land + 3.30), "r2_trim_coral")
    for py_c in (sy_top + 0.5, y1 - 2.6):
        mb.box((st_x0 - 0.45, py_c - 0.20, z0), (st_x0 - 0.05, py_c + 0.20, z_land + 3.1), "r2_wall_white_mosaic", skip=("-z",))

    # Low front hedge & planter box right in front of grand stairs (visible bottom-left of campus_library.jpg)
    mb.box((st_x0 - 1.2, y0 + 2.5, z0), (st_x1, sy_bot - 0.4, z0 + 0.52), "r2_wall_white_mosaic", skip=("-z",))
    mb.box((st_x0 - 1.0, y0 + 2.7, z0 + 0.52), (st_x1 - 0.2, sy_bot - 0.6, z0 + 1.08), "r2_foliage_hedge")

    # 5. Signature Tall Semicircular Arched Turquoise Glass Barrel Vault on WEST (-X) Facade above stairs!
    ay_c = sy_top + 2.6
    aw = 5.4
    ar = aw * 0.5
    ax_face = x0 - 0.35
    az_base = z0 + 2 * fh + 0.30
    az_rect_top = z_top + 2.7
    mb.box((ax_face, ay_c - ar - 0.75, az_base), (x0 + 7.5, ay_c - ar, az_rect_top), "r2_wall_white_mosaic")
    mb.box((ax_face, ay_c + ar, az_base), (x0 + 7.5, ay_c + ar + 0.75, az_rect_top), "r2_wall_white_mosaic")
    mb.quad((ax_face + 0.55, ay_c - ar, az_base), (ax_face + 0.55, ay_c + ar, az_base), (ax_face + 0.55, ay_c + ar, az_rect_top), (ax_face + 0.55, ay_c - ar, az_rect_top), "r2_interior_dark", ensure_dir=Vector((-1, 0, 0)))
    mb.quad((ax_face + 0.22, ay_c - ar, az_base), (ax_face + 0.22, ay_c + ar, az_base), (ax_face + 0.22, ay_c + ar, az_rect_top), (ax_face + 0.22, ay_c - ar, az_rect_top), "r2_glass_turquoise", ensure_dir=Vector((-1, 0, 0)))

    segs_a = 18
    for i in range(segs_a):
        a0 = math.pi * (i / segs_a)
        a1 = math.pi * ((i + 1) / segs_a)
        py0_a, pz0_a = ay_c + math.cos(a0) * ar, az_rect_top + math.sin(a0) * ar
        py1_a, pz1_a = ay_c + math.cos(a1) * ar, az_rect_top + math.sin(a1) * ar
        oy0_a, oz0_a = ay_c + math.cos(a0) * (ar + 0.75), az_rect_top + math.sin(a0) * (ar + 0.75)
        oy1_a, oz1_a = ay_c + math.cos(a1) * (ar + 0.75), az_rect_top + math.sin(a1) * (ar + 0.75)
        mb.tri((ax_face + 0.22, ay_c, az_rect_top), (ax_face + 0.22, py0_a, pz0_a), (ax_face + 0.22, py1_a, pz1_a), "r2_glass_turquoise", ensure_dir=Vector((-1, 0, 0)))
        mb.quad((ax_face, oy0_a, oz0_a), (ax_face, oy1_a, oz1_a), (x0 + 7.5, oy1_a, oz1_a), (x0 + 7.5, oy0_a, oz0_a), "r2_wall_white_mosaic", ensure_dir=Vector((0, 0, 1)))
        mb.quad((ax_face, oy0_a, oz0_a), (ax_face, py0_a, pz0_a), (ax_face, py1_a, pz1_a), (ax_face, oy1_a, oz1_a), "r2_wall_white_mosaic", ensure_dir=Vector((-1, 0, 0)))
    for my in (-1.35, 0.0, 1.35):
        h_ex = math.sqrt(max(0.0, ar * ar - my * my))
        mb.box((ax_face + 0.14, ay_c + my - 0.035, az_base), (ax_face + 0.28, ay_c + my + 0.035, az_rect_top + h_ex), "r2_mullion_silver")
    for hz in [az_base + 1.4, az_base + 2.8, az_base + 4.2, az_base + 5.6, az_rect_top]:
        mb.box((ax_face + 0.14, ay_c - ar, hz - 0.035), (ax_face + 0.28, ay_c + ar, hz + 0.035), "r2_mullion_silver")

    # 6. Engaged South-East Glazed Cylindrical Staircase Tower (visible right edge of campus_library.jpg!)
    tc_x, tc_y = x1 - 1.2, y0 + 1.4
    tr_r = 2.7
    mb.cylinder((tc_x, tc_y, z0), tr_r, tr_r, z_top + 1.2 - z0, 18, "r2_glass_turquoise")
    for fl in range(floors + 1):
        zf = z0 + fl * fh
        mb.cylinder((tc_x, tc_y, zf), tr_r + 0.14, tr_r + 0.14, 0.34, 18, "r2_wall_white_mosaic")
        mb.cylinder((tc_x, tc_y, zf + 0.09), tr_r + 0.17, tr_r + 0.17, 0.12, 18, "r2_trim_coral")
    mb.cylinder((tc_x, tc_y, z_top + 1.2), tr_r + 0.18, tr_r + 0.18, 0.38, 18, "r2_wall_white_mosaic")

    # 7. Rooftop Astronomical Observatory Dome on South-Right Skyline (prominent against sky in campus_library.jpg!)
    dx, dy = x0 + 23.8, y0 + 3.8
    mb.cylinder((dx, dy, z_top + 0.34), 3.25, 3.25, 2.05, 28, "r2_wall_white_mosaic")
    mb.cylinder((dx, dy, z_top + 2.39), 2.98, 2.98, 1.20, 28, "r2_glass_turquoise")
    for i in range(16):
        a = (i / 16.0) * math.tau
        mx, my = dx + math.cos(a) * 3.01, dy + math.sin(a) * 3.01
        mb.box((mx - 0.05, my - 0.05, z_top + 2.39), (mx + 0.05, my + 0.05, z_top + 3.59), "r2_mullion_silver")
    mb.cylinder((dx, dy, z_top + 3.59), 3.18, 3.18, 0.34, 28, "r2_wall_white_mosaic")

    z_dome = z_top + 3.93
    profile = [(3.06, 0.0), (3.25, 0.48), (3.28, 1.10), (3.08, 1.82), (2.64, 2.52), (1.90, 3.18), (0.94, 3.60), (0.0, 3.82)]
    mb.lathe((dx, dy, z_dome), profile, 32, "r2_dome_zinc")
    for i in range(20):
        a = (i / 20.0) * math.tau
        pts = [Vector((dx + math.cos(a) * (r + 0.03), dy + math.sin(a) * (r + 0.03), z_dome + z)) for r, z in profile]
        mb.tube(pts, 0.042, 6, "r2_mullion_bronze")

    lib_obj = mb.finalize(
        "library_observatory_r2", coll,
        extras={
            "haiz_building_id": "library",
            "haiz_district": "d04_heritage_gardens",
            "haiz_tag": "photo-derived/public-map",
            "haiz_basis": "campus_library.jpg + aerial_campus.jpg; Round 2 v2 west grand stairs + barrel arch, SW chamfered mosaic balconies w/ coral trim & 20-ribbed observatory dome",
            "haiz_name": "图书馆与天文台",
        },
        smooth=False,
    )
    return [lib_obj]
