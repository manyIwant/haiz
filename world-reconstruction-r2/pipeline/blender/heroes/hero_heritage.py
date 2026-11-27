"""
HAIZ · World Reconstruction Round 2 — Hero Landmark 3: 凤栖堂、衍林亭与书院群 (Heritage Precinct)
Faithfully reconstructed from:
  - assets/images/campus/campus_fengqitang.jpg:
      Single-storey emerald barrel-tile gabled hall, white walls, 8 golden-brown varnished timber columns
      on carved pale granite drum bases, ornate front porch frieze brackets, mahogany doors & multi-pane windows,
      flanked by dark bronze scholar statue ('春风化雨') on red-plaque granite pedestal.
  - assets/images/campus/campus_yanlintang.jpg:
      Square 4-column emerald glazed curved pyramidal pavilion (四角攒尖顶) with deep crimson lacquer
      eave rafters & Meirenkao (美人靠) outward-leaning benches, carved golden brackets, black-and-gold
      vertical column couplets (楹联), stone plinth steps & emerald gourd finial (宝顶).
"""
import math
import bpy
from mathutils import Matrix, Vector
import pbr_materials
from arch_detail import R2Mesh


def _build_heritage_hall(mb: R2Mesh, cx: float, cy: float, w: float, d: float, face_south: bool, bid: str):
    """Build authentic Fengqitang / Yanlintang single-storey hall (campus_fengqitang.jpg)."""
    z0 = 0.15
    plinth_h = 0.55
    eave_z = z0 + plinth_h + 4.05
    front_sign = -1.0 if face_south else 1.0  # -Y faces courtyard toward Forecourt; +Y faces north

    # Granite terrace plinth + 3 front steps
    mb.box((cx - w * 0.5 - 0.8, cy - d * 0.5 - 1.6, z0), (cx + w * 0.5 + 0.8, cy + d * 0.5 + 1.6, z0 + plinth_h), "r2_stone_granite_grey", skip=("-z",))
    for k in range(3):
        sy = cy + front_sign * (d * 0.5 + 1.6 + k * 0.42)
        sy_next = sy + front_sign * 0.44
        mb.box((cx - 4.2, min(sy, sy_next), z0), (cx + 4.2, max(sy, sy_next), z0 + plinth_h - k * 0.16), "r2_stone_granite_grey")

    # Whitewashed enclosed masonry body behind open front verandah
    ver_d = 1.85
    if face_south:
        wy0, wy1 = cy - d * 0.5 + ver_d, cy + d * 0.5 - 0.4
        col_y = cy - d * 0.5 - 0.45
    else:
        wy0, wy1 = cy - d * 0.5 + 0.4, cy + d * 0.5 - ver_d
        col_y = cy + d * 0.5 + 0.45

    mb.box((cx - w * 0.5 + 0.5, wy0, z0 + plinth_h), (cx + w * 0.5 - 0.5, wy1, eave_z), "r2_wall_white_matte", skip=("-z",))

    # Front porch facade: mahogany doors (center + end bays) & white-muntin mahogany-framed lattice windows (campus_fengqitang.jpg!)
    front_wall_y = wy0 if face_south else wy1
    out_v = Vector((0, front_sign, 0))
    u_v = Vector((1, 0, 0)) if not face_south else Vector((-1, 0, 0))
    n_bays = 7
    bw = (w - 1.4) / n_bays
    for bi in range(n_bays):
        bx = cx - (w - 1.4) * 0.5 + (bi + 0.5) * bw
        if bi in (1, 5):  # Tall carved mahogany doorways + transom
            mb.box((bx - 0.88, front_wall_y - 0.09, z0 + plinth_h), (bx + 0.88, front_wall_y + 0.09, z0 + plinth_h + 3.05), "r2_wood_mahogany")
            mb.box((bx - 0.72, front_wall_y - 0.10, z0 + plinth_h + 2.45), (bx + 0.72, front_wall_y + 0.10, z0 + plinth_h + 2.92), "r2_trim_white")
        elif bi in (0, 6):
            mb.box((bx - 0.86, front_wall_y - 0.08, z0 + plinth_h + 0.78), (bx + 0.86, front_wall_y + 0.08, z0 + plinth_h + 2.82), "r2_wood_mahogany")
            mb.add_window_assembly(Vector((bx, front_wall_y, z0 + plinth_h + 0.85)), u_v, out_v, 1.5, 1.9, frame_mat="r2_trim_white", panes_x=3)
        else:
            mb.box((bx - 1.02, front_wall_y - 0.08, z0 + plinth_h + 0.78), (bx + 1.02, front_wall_y + 0.08, z0 + plinth_h + 2.82), "r2_wood_mahogany")
            mb.add_window_assembly(Vector((bx, front_wall_y, z0 + plinth_h + 0.85)), u_v, out_v, 1.82, 1.9, frame_mat="r2_trim_white", panes_x=4)

    # 8 Cylindrical Golden-Ochre Timber Columns on Carved Stone Drum Bases (柱础) + ornate gold-accented lintel
    col_n = 8
    for i in range(col_n):
        kx = cx - w * 0.5 + 0.7 + i * ((w - 1.4) / (col_n - 1))
        # Carved pale stone drum base
        mb.lathe((kx, col_y, z0 + plinth_h), [(0.26, 0.0), (0.28, 0.08), (0.25, 0.18), (0.20, 0.24)], 14, "r2_stone_carved_pale")
        # Tapered golden-ochre timber column
        mb.cylinder((kx, col_y, z0 + plinth_h + 0.22), 0.175, 0.155, eave_z - (z0 + plinth_h + 0.22), 14, "r2_wood_golden")
        # Ornate gilded under-eave bracket block (斗拱)
        mb.box((kx - 0.22, col_y - 0.20, eave_z - 0.35), (kx + 0.22, col_y + 0.20, eave_z), "r2_gold_leaf")
        # Traditional low wood balustrade railing connecting outer verandah bays (leaving center entry open!)
        if i not in (3,) and i < col_n - 1:
            nx = cx - w * 0.5 + 0.7 + (i + 1) * ((w - 1.4) / (col_n - 1))
            if abs(i - 3) > 0:
                mb.box((kx + 0.15, col_y - 0.06, z0 + plinth_h + 0.62), (nx - 0.15, col_y + 0.06, z0 + plinth_h + 0.72), "r2_wood_mahogany")
                for b_sub in range(5):
                    sx = kx + 0.35 + b_sub * ((nx - kx - 0.7) / 4.0)
                    mb.box((sx - 0.04, col_y - 0.04, z0 + plinth_h + 0.05), (sx + 0.04, col_y + 0.04, z0 + plinth_h + 0.62), "r2_wood_mahogany")

    # Continuous verandah header beam + ornate lattice band
    mb.box((cx - w * 0.5, col_y - 0.18, eave_z - 0.24), (cx + w * 0.5, col_y + 0.18, eave_z + 0.06), "r2_wood_golden")
    mb.box((cx - w * 0.5, col_y - 0.20, eave_z - 0.42), (cx + w * 0.5, col_y + 0.20, eave_z - 0.32), "r2_gold_leaf")

    # Sweeping Emerald Glazed Barrel-Tile Gable/Hip Roof (campus_fengqitang.jpg shows continuous bright emerald barrel ridge & green tiles!)
    mb.add_lingnan_barrel_roof(
        cx - w * 0.5, cy - d * 0.5 - 0.4, cx + w * 0.5, cy + d * 0.5 + 0.4,
        z_eave=eave_z + 0.08, pitch_deg=30.0, overhang=1.05, concave=0.14, upturn=0.35,
        tile_mat="r2_roof_emerald", trim_mat="r2_trim_white", wadan_mat="r2_roof_emerald", soffit_mat="r2_wood_mahogany",
        tile_pitch=0.22, ridge_h=0.30, is_gable_x=True
    )


def _build_bronze_scholar_statue(mb: R2Mesh, cx: float, cy: float, z0: float = 0.15):
    """Patinated bronze standing scholar statue on dark granite pedestal with crimson nameplate (campus_fengqitang.jpg)."""
    # Stepped base & vertical square granite pedestal
    mb.box((cx - 1.15, cy - 1.15, z0), (cx + 1.15, cy + 1.15, z0 + 0.18), "r2_stone_granite_dark")
    mb.box((cx - 0.85, cy - 0.85, z0 + 0.18), (cx + 0.85, cy + 0.85, z0 + 0.36), "r2_stone_granite_dark")
    mb.box((cx - 0.62, cy - 0.62, z0 + 0.36), (cx + 0.62, cy + 0.62, z0 + 1.48), "r2_stone_granite_grey")
    # Inset crimson-gold inscription tablet on south & north faces
    mb.box((cx - 0.42, cy - 0.64, z0 + 0.72), (cx + 0.42, cy - 0.61, z0 + 1.18), "r2_plaque_crimson")
    mb.box((cx - 0.42, cy + 0.61, z0 + 0.72), (cx + 0.42, cy + 0.64, z0 + 1.18), "r2_plaque_crimson")
    # Sculpted dark bronze robed figure
    sz = z0 + 1.48
    mb.lathe((cx, cy, sz), [(0.42, 0.0), (0.38, 0.25), (0.32, 0.75), (0.34, 1.15), (0.26, 1.48), (0.14, 1.56), (0.0, 1.62)], 16, "r2_bronze_patina")
    # Clasped sleeves + bronze head & traditional hairbun
    mb.box((cx - 0.24, cy - 0.32, sz + 1.05), (cx + 0.24, cy - 0.12, sz + 1.32), "r2_bronze_patina")
    mb.lathe((cx, cy, sz + 1.60), [(0.0, 0.0), (0.14, 0.08), (0.16, 0.22), (0.13, 0.35), (0.0, 0.42)], 12, "r2_bronze_patina")


def _build_emerald_pavilion(mb: R2Mesh, cx: float, cy: float, half_w: float, mat_roof: str = "r2_roof_emerald"):
    """
    Iconic Yanlinting / Fengqiting square garden pavilion (campus_yanlintang.jpg):
      - 2-step grey granite square plinth
      - 4 round crimson-lacquered timber columns on carved stone drum bases
      - Meirenkao (美人靠) outward-leaning crimson slatted benches on 3/4 sides
      - Vertical dark wood couplet plaques + golden corner brackets (雀替)
      - Crimson timber fascia + soffit + soaring emerald barrel-tile pyramidal roof w/ gourd finial!
    """
    z0 = 0.15
    p_h = 0.48
    eave_z = z0 + p_h + 3.45

    # Two-step granite base
    mb.box((cx - half_w - 0.95, cy - half_w - 0.95, z0), (cx + half_w + 0.95, cy + half_w + 0.95, z0 + 0.24), "r2_stone_granite_grey", skip=("-z",))
    mb.box((cx - half_w - 0.55, cy - half_w - 0.55, z0 + 0.24), (cx + half_w + 0.55, cy + half_w + 0.55, z0 + p_h), "r2_paving_stagger", skip=("-z",))

    # Corner crimson columns + stone drum bases + vertical couplet tablets (楹联)
    col_off = half_w - 0.32
    for sx in (-1, 1):
        for sy in (-1, 1):
            kx, ky = cx + sx * col_off, cy + sy * col_off
            mb.lathe((kx, ky, z0 + p_h), [(0.26, 0.0), (0.28, 0.09), (0.23, 0.20), (0.19, 0.26)], 14, "r2_stone_carved_pale")
            mb.cylinder((kx, ky, z0 + p_h + 0.24), 0.17, 0.15, eave_z - (z0 + p_h + 0.24), 14, "r2_lacquer_crimson")
            # Ornate golden bracket corbel (雀替) near top of column
            mb.box((kx - 0.22, ky - 0.22, eave_z - 0.46), (kx + 0.22, ky + 0.22, eave_z - 0.16), "r2_gold_leaf")
            # Dark vertical lacquered wooden couplet plaque on the front columns (facing south/west toward camera!)
            if sy == -1:
                mb.box((kx - 0.09, ky - 0.20, z0 + p_h + 1.05), (kx + 0.09, ky - 0.15, z0 + p_h + 2.55), "r2_wood_mahogany")
                mb.box((kx - 0.05, ky - 0.21, z0 + p_h + 1.18), (kx + 0.05, ky - 0.19, z0 + p_h + 2.42), "r2_gold_leaf")

    # Meirenkao (美人靠) prominent crimson bench seating & dense 14-slat outward-leaning backrests (campus_yanlintang.jpg!)
    seat_z = z0 + p_h + 0.48
    for side in ("N", "W", "E"):
        if side == "N":
            mb.box((cx - col_off + 0.14, cy + col_off - 0.24, seat_z), (cx + col_off - 0.14, cy + col_off + 0.26, seat_z + 0.09), "r2_lacquer_crimson")
            mb.box((cx - col_off + 0.14, cy + col_off + 0.28, seat_z + 0.56), (cx + col_off - 0.14, cy + col_off + 0.40, seat_z + 0.66), "r2_lacquer_crimson")
            for k in range(15):
                sx = cx - col_off + 0.28 + k * ((col_off * 2 - 0.56) / 14.0)
                mb.box((sx - 0.032, cy + col_off + 0.20, seat_z + 0.04), (sx + 0.032, cy + col_off + 0.34, seat_z + 0.58), "r2_lacquer_crimson")
        elif side == "W":
            mb.box((cx - col_off - 0.26, cy - col_off + 0.14, seat_z), (cx - col_off + 0.24, cy + col_off - 0.14, seat_z + 0.09), "r2_lacquer_crimson")
            mb.box((cx - col_off - 0.40, cy - col_off + 0.14, seat_z + 0.56), (cx - col_off - 0.28, cy + col_off - 0.14, seat_z + 0.66), "r2_lacquer_crimson")
            for k in range(15):
                sy = cy - col_off + 0.28 + k * ((col_off * 2 - 0.56) / 14.0)
                mb.box((cx - col_off - 0.34, sy - 0.032, seat_z + 0.04), (cx - col_off - 0.20, sy + 0.032, seat_z + 0.58), "r2_lacquer_crimson")
        elif side == "E":
            mb.box((cx + col_off - 0.24, cy - col_off + 0.14, seat_z), (cx + col_off + 0.26, cy + col_off - 0.14, seat_z + 0.09), "r2_lacquer_crimson")
            mb.box((cx + col_off + 0.28, cy - col_off + 0.14, seat_z + 0.56), (cx + col_off + 0.40, cy + col_off - 0.14, seat_z + 0.66), "r2_lacquer_crimson")
            for k in range(15):
                sy = cy - col_off + 0.28 + k * ((col_off * 2 - 0.56) / 14.0)
                mb.box((cx + col_off + 0.20, sy - 0.032, seat_z + 0.04), (cx + col_off + 0.34, sy + 0.032, seat_z + 0.58), "r2_lacquer_crimson")

    # Crimson perimeter tie-beams & carved wood soffit frame + carved dark-wood name tablets (no blank white board!)
    mb.box((cx - col_off - 0.16, cy - col_off - 0.16, eave_z - 0.28), (cx + col_off + 0.16, cy - col_off + 0.16, eave_z + 0.06), "r2_lacquer_crimson")
    mb.box((cx - col_off - 0.16, cy + col_off - 0.16, eave_z - 0.28), (cx + col_off + 0.16, cy + col_off + 0.16, eave_z + 0.06), "r2_lacquer_crimson")
    mb.box((cx - col_off - 0.16, cy - col_off, eave_z - 0.28), (cx - col_off + 0.16, cy + col_off, eave_z + 0.06), "r2_lacquer_crimson")
    mb.box((cx + col_off - 0.16, cy - col_off, eave_z - 0.28), (cx + col_off + 0.16, cy + col_off, eave_z + 0.06), "r2_lacquer_crimson")
    # Ornate carved mahogany plaques with gold border above south & west entry (campus_yanlintang.jpg!)
    mb.box((cx - 0.92, cy - col_off - 0.19, eave_z - 0.46), (cx + 0.92, cy - col_off - 0.14, eave_z - 0.14), "r2_wood_mahogany")
    mb.box((cx - 0.88, cy - col_off - 0.20, eave_z - 0.43), (cx + 0.88, cy - col_off - 0.18, eave_z - 0.17), "r2_gold_leaf")
    mb.box((cx - 0.84, cy - col_off - 0.21, eave_z - 0.40), (cx + 0.84, cy - col_off - 0.19, eave_z - 0.20), "r2_wood_mahogany")

    mb.box((cx - col_off - 0.19, cy - 0.92, eave_z - 0.46), (cx - col_off - 0.14, cy + 0.92, eave_z - 0.14), "r2_wood_mahogany")
    mb.box((cx - col_off - 0.20, cy - 0.88, eave_z - 0.43), (cx - col_off - 0.18, cy + 0.88, eave_z - 0.17), "r2_gold_leaf")
    mb.box((cx - col_off - 0.21, cy - 0.84, eave_z - 0.40), (cx - col_off - 0.19, cy + 0.84, eave_z - 0.20), "r2_wood_mahogany")

    # Soaring Square Pyramidal Emerald Glazed Barrel Roof (clean crimson hip fascia & emerald gourd finial)
    mb.add_lingnan_barrel_roof(
        cx - half_w, cy - half_w, cx + half_w, cy + half_w,
        z_eave=eave_z + 0.08, pitch_deg=34.0, overhang=1.08, concave=0.22, upturn=0.72,
        tile_mat=mat_roof, trim_mat="r2_lacquer_crimson", wadan_mat=mat_roof, soffit_mat="r2_wood_golden",
        tile_pitch=0.20, ridge_h=0.20, finial_peak=1.08
    )


def build_heritage_complex(mats: dict, coll: bpy.types.Collection, font=None) -> list[bpy.types.Object]:
    """
    Build all 4 iconic green-glazed heritage courtyard buildings:
      - 凤栖堂 (Fengqitang Hall, OSM west forecourt) + 春风化雨 bronze scholar statue
      - 衍林堂 (Yanlintang Hall, OSM east forecourt)
      - 凤栖亭 (Fengqiting Emerald Pavilion)
      - 衍林亭 (Yanlinting Emerald Pavilion, matching campus_yanlintang.jpg)
    """
    objs = []

    # 1. Fengqitang + Statue + Courtyard Garden Lantern Bollards
    mb_fq = R2Mesh(mats)
    _build_heritage_hall(mb_fq, cx=-43.1, cy=76.8, w=25.0, d=14.8, face_south=True, bid="fengqitang")
    _build_bronze_scholar_statue(mb_fq, cx=-43.1, cy=61.8, z0=0.15)
    for lx in (-45.8, -40.4):
        for ly in (55.5, 60.2):
            mb_fq.box((lx - 0.14, ly - 0.14, 0.15), (lx + 0.14, ly + 0.14, 0.72), "r2_stone_granite_dark")
            mb_fq.box((lx - 0.16, ly - 0.16, 0.72), (lx + 0.16, ly + 0.16, 0.90), "r2_gold_leaf")
    objs.append(mb_fq.finalize(
        "fengqitang_hall_r2", coll,
        extras={
            "haiz_building_id": "fengqitang",
            "haiz_district": "d04_heritage_gardens",
            "haiz_tag": "photo-derived/public-map",
            "haiz_basis": "campus_fengqitang.jpg + OSM polygon; emerald barrel tiles, 8 golden timber columns, stone drum bases, bronze scholar statue",
            "haiz_name": "凤栖堂",
        }
    ))
    if font is not None:
        objs.append(pbr_materials.add_cjk_text_object(
            "statue_plaque_text", "春风化雨", size=0.14, extrude=0.01, mat=mats["r2_gold_leaf"],
            location=(-43.1, 61.8 - 0.65, 0.15 + 0.95), rotation_euler=(math.pi * 0.5, 0.0, 0.0),
            collection=coll, font=font
        ))

    # 2. Yanlintang
    mb_ylt = R2Mesh(mats)
    _build_heritage_hall(mb_ylt, cx=66.7, cy=63.0, w=25.0, d=14.5, face_south=True, bid="yanlintang")
    objs.append(mb_ylt.finalize(
        "yanlintang_hall_r2", coll,
        extras={
            "haiz_building_id": "yanlintang",
            "haiz_district": "d04_heritage_gardens",
            "haiz_tag": "public-map/estimated",
            "haiz_basis": "OSM polygon + twin heritage hall typology; symmetric emerald-roofed lecture hall",
            "haiz_name": "衍林堂",
        }
    ))

    # 3. Yanlinting Emerald Pavilion (campus_yanlintang.jpg!)
    mb_ylp = R2Mesh(mats)
    _build_emerald_pavilion(mb_ylp, cx=34.0, cy=55.0, half_w=2.95)
    objs.append(mb_ylp.finalize(
        "yanlinting_pavilion_r2", coll,
        extras={
            "haiz_building_id": "yanlinting",
            "haiz_district": "d04_heritage_gardens",
            "haiz_tag": "photo-derived/estimated",
            "haiz_basis": "campus_yanlintang.jpg; double-curved emerald pyramidal pavilion, crimson soffits/columns, couplets & Meirenkao benches",
            "haiz_name": "衍林亭",
        }
    ))
    if font is not None:
        objs.append(pbr_materials.add_cjk_text_object(
            "yanlinting_tablet_text_s", "衍 林 亭", size=0.20, extrude=0.014, mat=mats["r2_gold_leaf"],
            location=(34.0, 55.0 - 2.63 - 0.22, 0.15 + 0.48 + 3.45 - 0.30), rotation_euler=(math.pi * 0.5, 0.0, 0.0),
            collection=coll, font=font
        ))
        objs.append(pbr_materials.add_cjk_text_object(
            "yanlinting_tablet_text_w", "衍 林 亭", size=0.20, extrude=0.014, mat=mats["r2_gold_leaf"],
            location=(34.0 - 2.63 - 0.22, 55.0, 0.15 + 0.48 + 3.45 - 0.30), rotation_euler=(math.pi * 0.5, 0.0, -math.pi * 0.5),
            collection=coll, font=font
        ))

    # 4. Fengqiting Emerald Pavilion (east edge of Fengqitang courtyard flanking Palm Avenue cleanly, leaving statue open!)
    mb_fqp = R2Mesh(mats)
    _build_emerald_pavilion(mb_fqp, cx=-29.5, cy=56.0, half_w=2.95)
    objs.append(mb_fqp.finalize(
        "fengqiting_pavilion_r2", coll,
        extras={
            "haiz_building_id": "fengqiting",
            "haiz_district": "d04_heritage_gardens",
            "haiz_tag": "photo-derived/estimated",
            "haiz_basis": "Symmetric heritage garden pavilion west of central palm avenue",
            "haiz_name": "凤栖亭",
        }
    ))
    return objs
