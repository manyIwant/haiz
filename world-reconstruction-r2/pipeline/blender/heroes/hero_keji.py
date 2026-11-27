"""
HAIZ · World Reconstruction Round 2 — Hero Landmark 4: 科技楼 (Science & Technology Building)
Faithfully reconstructed from assets/images/campus/campus_keji.jpg:
  - 5-storey modern tropical facade facing SW/South toward the North Forecourt (x=[18, 58], y=[78, 97])
  - Left 3 wide window bays with recessed dark-brown horizontal louver spandrel panels
  - Center-left slender champagne-beige masonry pilasters alternating with narrow vertical glass bays
  - Dramatic double-height bronze-framed reflective glass entrance lobby (Floors 1-2) with stone steps
  - Above lobby (Floors 3-4): tall champagne vertical fins & lower louvered grilles + 5th-storey ribbon clerestory
  - Foreground: smooth pale concrete apron transitioning to dark staggered granite plaza & left guard gatehouse!
"""
import bpy
from mathutils import Vector
from arch_detail import R2Mesh


def build_keji(mats: dict, coll: bpy.types.Collection, font=None) -> list[bpy.types.Object]:
    # Footprint x=[18.0, 58.0] (W=40m), y=[78.0, 97.0] (D=19m), South showcase facade at y=78.0 facing plaza!
    x0, y0, x1, y1 = 18.0, 78.0, 58.0, 97.0
    z0 = 0.15
    plinth_h = 0.45
    sh = 3.75
    floors = 5
    z_top = z0 + plinth_h + floors * sh

    mb = R2Mesh(mats)

    # 1. Dark granite ground plinth + wide concrete sidewalk apron + foreground lawn strip (cleanly proud of z=0.15 forecourt datum!)
    mb.box((x0 - 0.3, y0 - 0.3, z0 - 0.02), (x1 + 0.3, y1 + 0.3, z0 + plinth_h), "r2_stone_granite_dark", skip=("-z",))
    mb.box((x0 - 3.5, y0 - 5.2, z0 + 0.005), (x1 + 2.5, y0, z0 + 0.03), "r2_paving_plaza")
    mb.box((x0 + 3.5, y0 - 15.5, z0 + 0.005), (x1 - 2.5, y0 - 5.2, z0 + 0.02), "r2_ground_lawn", uv_scale=0.15)
    mb.box((x0 + 3.5, y0 - 5.4, z0 + 0.02), (x1 - 2.5, y0 - 5.2, z0 + 0.06), "r2_stone_granite_grey")

    # Main masonry structural shell recessed inside facade rhythm
    mb.box((x0 + 0.4, y0 + 0.45, z0 + plinth_h), (x1 - 0.4, y1 - 0.4, z_top), "r2_wall_white_mosaic", skip=("-z",))

    # 2. South Showcase Facade (y = y0, facing -Y toward campus plaza, reading LEFT->RIGHT in campus_keji.jpg!):
    # Note: standing South looking North (+Y): viewer-LEFT is -X (x=18..), viewer-RIGHT is +X (..x=58)!
    # So Left bays at x=18..31 = 3 wide windows + brown horizontal louver spandrels!
    # Center-left x=31..39 = 5 narrow champagne vertical piers + narrow recessed vertical glass slots!
    # Center-right x=39..55 = Double-height bronze-framed curtain wall lobby (F1-F2) + champagne vertical fin bays (F3-F4) + ribbon clerestory (F5)!
    # Far right solid crisp white wing corner x=55..58!

    u_s = Vector((1, 0, 0))
    out_s = Vector((0, -1, 0))

    # Outer white vertical pier frames bracketing the main composition (stop cleanly at F5 sill & slightly proud to avoid coplanar Z-fighting!)
    mb.box((x0, y0 - 0.01, z0 + plinth_h), (x0 + 1.1, y0 + 0.55, z0 + plinth_h + 4 * sh), "r2_wall_white_mosaic")
    mb.box((x1 - 2.6, y0 - 0.01, z0 + plinth_h), (x1, y0 + 0.55, z0 + plinth_h + 4 * sh), "r2_wall_white_mosaic")

    # -- Zone A: Left 3 Wide Window Bays with Brown Louver Spandrels (x = 19.1 .. 29.8, Floors 1..4) --
    ax0, ax1 = 19.1, 29.8
    nb_a = 3
    bw_a = (ax1 - ax0) / nb_a
    for fl in range(4):
        zf = z0 + plinth_h + fl * sh
        for bi in range(nb_a):
            bx = ax0 + (bi + 0.5) * bw_a
            # Lower spandrel: recessed brown wood horizontal louver box
            mb.box((bx - bw_a * 0.40, y0 + 0.08, zf + 0.16), (bx + bw_a * 0.40, y0 + 0.45, zf + 1.12), "r2_louver_wood")
            mb.box((bx - bw_a * 0.5, y0, zf + 0.005), (bx - bw_a * 0.40, y0 + 0.50, zf + 3.33), "r2_wall_white_mosaic")
            mb.box((bx + bw_a * 0.40, y0, zf + 0.005), (bx + bw_a * 0.5, y0 + 0.50, zf + 3.33), "r2_wall_white_mosaic")
            # Upper wide multi-pane dark-framed window
            mb.add_window_assembly(
                Vector((bx, y0 + 0.18, zf + 1.18)), u_s, out_s, bw_a * 0.78, 2.15,
                frame_mat="r2_mullion_bronze", glass_mat="r2_glass_bronze", recess=0.26, panes_x=2
            )
            mb.box((bx - bw_a * 0.5, y0 - 0.008, zf + 3.33), (bx + bw_a * 0.5, y0 + 0.50, zf + sh), "r2_wall_white_mosaic")

    # -- Zone B: Champagne Vertical Pilasters & Slender Bays (x = 29.8 .. 38.6, Floors 1..4) --
    bx0, bx1 = 29.8, 38.6
    nb_b = 5
    bw_b = (bx1 - bx0) / nb_b
    for bi in range(nb_b):
        px = bx0 + bi * bw_b
        # Full-height champagne vertical pilaster proud of glass
        mb.box((px, y0 - 0.06, z0 + plinth_h), (px + 0.72, y0 + 0.50, z0 + plinth_h + 4 * sh), "r2_wall_champagne")
        vx_c = px + 0.72 + (bw_b - 0.72) * 0.5
        vw = (bw_b - 0.78)
        for fl in range(4):
            zf = z0 + plinth_h + fl * sh
            mb.box((px + 0.70, y0 + 0.12, zf), (px + bw_b, y0 + 0.48, zf + 0.35), "r2_wall_champagne")
            mb.add_window_assembly(
                Vector((vx_c, y0 + 0.24, zf + 0.35)), u_s, out_s, vw, sh - 0.65,
                frame_mat="r2_mullion_bronze", glass_mat="r2_glass_bronze", recess=0.22, panes_x=1, has_transom=True
            )
    mb.box((bx1, y0 - 0.06, z0 + plinth_h), (bx1 + 0.72, y0 + 0.50, z0 + plinth_h + 4 * sh), "r2_wall_champagne")

    # -- Zone C: Double-Height Bronze Curtain-Wall Lobby (x = 39.32 .. 55.4, Floors 1..2) + Upper Fin Array (Floors 3..4) --
    cx0, cx1 = 39.32, 55.4
    lobby_h = 2 * sh
    # Dark interior depth behind reflective bronze curtain wall
    mb.quad((cx0 + 0.1, y0 + 0.75, z0 + plinth_h), (cx1 - 0.1, y0 + 0.75, z0 + plinth_h),
            (cx1 - 0.1, y0 + 0.75, z0 + plinth_h + lobby_h), (cx0 + 0.1, y0 + 0.75, z0 + plinth_h + lobby_h), "r2_interior_dark")
    # Reflective bronze curtain glass
    mb.quad((cx0 + 0.1, y0 + 0.25, z0 + plinth_h), (cx1 - 0.1, y0 + 0.25, z0 + plinth_h),
            (cx1 - 0.1, y0 + 0.25, z0 + plinth_h + lobby_h), (cx0 + 0.1, y0 + 0.25, z0 + plinth_h + lobby_h), "r2_glass_bronze")
    # Deep bronze vertical fins & horizontal transoms across lobby (10 bays!)
    n_c = 10
    for i in range(n_c + 1):
        fx = cx0 + i * ((cx1 - cx0) / n_c)
        mb.box((fx - 0.055, y0 + 0.02, z0 + plinth_h), (fx + 0.055, y0 + 0.34, z0 + plinth_h + lobby_h), "r2_mullion_bronze")
    for hz in [z0 + plinth_h + 2.4, z0 + plinth_h + 3.85, z0 + plinth_h + 5.6, z0 + plinth_h + lobby_h - 0.12]:
        mb.box((cx0, y0 + 0.02, hz - 0.06), (cx1, y0 + 0.34, hz + 0.06), "r2_mullion_bronze")
    # Wide granite entrance step podium + sleek glass entry canopy
    mid_c = 0.5 * (cx0 + cx1)
    mb.box((mid_c - 3.6, y0 - 1.4, z0), (mid_c + 3.6, y0 + 0.2, z0 + plinth_h), "r2_stone_granite_grey")
    mb.box((mid_c - 4.0, y0 - 1.8, z0 + 3.45), (mid_c + 4.0, y0 + 0.15, z0 + 3.65), "r2_mullion_bronze")

    # Floors 3..4 above lobby: 8 rhythm CRISP WHITE vertical fins with paired windows & dark louver bottom grilles (campus_keji.jpg!)
    n_f = 8
    bw_f = (cx1 - cx0) / n_f
    for fl in (2, 3):
        zf = z0 + plinth_h + fl * sh
        for bi in range(n_f):
            fx = cx0 + bi * bw_f
            mb.box((fx, y0 - 0.04, zf), (fx + 0.56, y0 + 0.48, zf + sh), "r2_wall_white_mosaic")
            vx = fx + 0.56 + (bw_f - 0.56) * 0.5
            vw = bw_f - 0.62
            mb.box((fx + 0.54, y0 + 0.15, zf + 0.12), (fx + bw_f, y0 + 0.45, zf + 1.05), "r2_louver_wood")
            mb.add_window_assembly(
                Vector((vx, y0 + 0.20, zf + 1.08)), u_s, out_s, vw, sh - 1.35,
                frame_mat="r2_mullion_bronze", glass_mat="r2_glass_bronze", recess=0.22, panes_x=2
            )

    # 3 crisp white granite entrance steps + two sleek black path lamps along forecourt edge (campus_keji.jpg foreground)
    for k in range(3):
        mb.box((mid_c - 3.6 - k * 0.35, y0 - 1.4 - k * 0.40, z0), (mid_c + 3.6 + k * 0.35, y0 - 1.4 - (k - 1) * 0.40, z0 + (3 - k) * 0.15), "r2_stone_granite_grey")
    for lx in (ax0 + 4.8, cx1 - 2.5):
        mb.cylinder((lx, y0 - 4.2, z0 + 0.12), 0.075, 0.055, 3.6, 8, "r2_mullion_bronze")
        mb.cylinder((lx, y0 - 4.2, z0 + 3.72), 0.22, 0.10, 0.38, 10, "r2_mullion_bronze")

    # -- 5th-Storey Continuous Ribbon Clerestory Window Band across entire top + Roof Parapet (campus_keji.jpg!) --
    zf5 = z0 + plinth_h + 4 * sh
    mb.box((x0, y0, zf5), (x1, y0 + 0.50, zf5 + 0.48), "r2_wall_white_mosaic")
    mb.quad((ax0, y0 + 0.35, zf5 + 0.48), (cx1, y0 + 0.35, zf5 + 0.48), (cx1, y0 + 0.35, z_top - 1.1), (ax0, y0 + 0.35, z_top - 1.1), "r2_glass_bronze")
    mb.box((x0, y0, zf5 + 0.48), (ax0, y0 + 0.50, z_top - 1.1), "r2_wall_white_mosaic")
    mb.box((cx1, y0, zf5 + 0.48), (x1, y0 + 0.50, z_top - 1.1), "r2_wall_white_mosaic")
    for k in range(28):
        mx = ax0 + k * ((cx1 - ax0) / 27.0)
        mb.box((mx - 0.04, y0 + 0.18, zf5 + 0.48), (mx + 0.04, y0 + 0.40, z_top - 1.1), "r2_mullion_bronze")
    mb.box((x0, y0 - 0.015, z_top - 1.1), (x1, y0 + 0.55, z_top + 0.45), "r2_wall_white_mosaic")

    # North/East/West secondary elevations & flat roof cap
    for fl in range(floors):
        zf = z0 + plinth_h + fl * sh
        for bi in range(8):
            bx = x0 + 2.0 + (bi + 0.5) * ((x1 - x0 - 4.0) / 8.0)
            mb.add_window_bay(
                Vector((bx, y1, zf)), Vector((-1, 0, 0)), Vector((0, 1, 0)),
                (x1 - x0 - 4.0) / 8.0, sh, 2.2, sh * 0.55, sill_h=0.9, recess=0.2,
                wall_mat="r2_wall_white_mosaic", frame_mat="r2_mullion_bronze", glass_mat="r2_glass_bronze", panes_x=2
            )
    mb.poly([(x0, y0, z_top + 0.46), (x1, y0, z_top + 0.46), (x1, y1, z_top + 0.46), (x0, y1, z_top + 0.46)], "r2_roof_flat")

    # Small emerald-roofed corner garden kiosk visible at far left in campus_keji.jpg
    mb.box((x0 - 4.6, y0 + 0.5, z0), (x0 - 1.6, y0 + 3.5, z0 + 2.75), "r2_wall_white_matte", skip=("-z",))
    mb.add_lingnan_barrel_roof(
        x0 - 4.6, y0 + 0.5, x0 - 1.6, y0 + 3.5, z_eave=z0 + 2.75, pitch_deg=28.0, overhang=0.45,
        concave=0.10, upturn=0.22, tile_mat="r2_roof_emerald", trim_mat="r2_trim_white", tile_pitch=0.22
    )

    keji_obj = mb.finalize(
        "keji_science_tech_r2", coll,
        extras={
            "haiz_building_id": "keji",
            "haiz_district": "d02_academic_core",
            "haiz_tag": "photo-derived/public-map",
            "haiz_basis": "campus_keji.jpg; Round 2 5-storey modern facade with brown horizontal louvers, champagne pilasters, double-height bronze lobby & ribbon clerestory",
            "haiz_name": "科技楼",
        }
    )
    return [keji_obj]
