"""
HAIZ · World Reconstruction Round 2 — Hero Landmark 1: 北门牌坊 (North Gate Paifang)
Calibrated to assets/images/web/hero-2560.jpg & twin/data/gate.json (photo-derived).
Privacy/Safety: intentionally omits modern security turnstiles, barrier arms & CCTV cameras.
"""
import json
import math
from pathlib import Path
import bpy
from mathutils import Matrix, Vector
import pbr_materials
from arch_detail import R2Mesh

REPO_ROOT = Path("/Users/a11/manyiwant/haiz-world-reconstruction-r2")
GATE = json.loads((REPO_ROOT / "twin/data/gate.json").read_text())


def _add_fretwork_band(mb: R2Mesh, x0: float, x1: float, z0: float, z1: float, y_face: float, sign: float):
    """True 3D green-and-cream meander key pattern frieze (回纹) as photographed in hero-2560.jpg."""
    yb = y_face + sign * 0.045
    mb.box((x0, min(y_face, yb), z0), (x1, max(y_face, yb), z1), "r2_fret_green")
    # Thin ochre outer rules above & below fretwork
    mb.box((x0 - 0.02, min(y_face, yb + sign * 0.015), z0 - 0.025), (x1 + 0.02, max(y_face, yb + sign * 0.015), z0 + 0.02), "r2_fret_ochre")
    mb.box((x0 - 0.02, min(y_face, yb + sign * 0.015), z1 - 0.02), (x1 + 0.02, max(y_face, yb + sign * 0.015), z1 + 0.025), "r2_fret_ochre")

    h = z1 - z0
    step_w = h * 1.15
    n = max(2, int((x1 - x0 - 0.08) / step_w))
    dw = (x1 - x0 - 0.08) / n
    yy = yb + sign * 0.014
    t = h * 0.14
    ya, yb_r = min(yb, yy), max(yb, yy)
    for i in range(n):
        cx = x0 + 0.04 + (i + 0.5) * dw
        ax, bx = cx - 0.35 * dw, cx + 0.35 * dw
        if i % 2 == 0:
            mb.box((ax, ya, z1 - 0.14 * h - t), (bx, yb_r, z1 - 0.14 * h), "r2_trim_white")
        else:
            mb.box((ax, ya, z0 + 0.14 * h), (bx, yb_r, z0 + 0.14 * h + t), "r2_trim_white")
        mb.box((bx - t, ya, z0 + 0.14 * h), (bx, yb_r, z1 - 0.14 * h), "r2_trim_white")


def _add_corner_bracket(mb: R2Mesh, x_pier: float, x_dir: float, z_top: float, w: float, h: float, y_face: float, sign: float):
    """Stepped ochre & green inlaid corner bracket (雀替) under central and side arches."""
    y0, y1 = min(y_face, y_face + sign * 0.09), max(y_face, y_face + sign * 0.09)
    n_dir = Vector((0, sign, 0))
    pts = [
        (x_pier, z_top),
        (x_pier + x_dir * w, z_top),
        (x_pier + x_dir * w * 0.78, z_top - h * 0.24),
        (x_pier + x_dir * w * 0.38, z_top - h * 0.48),
        (x_pier + x_dir * 0.14, z_top - h * 0.72),
        (x_pier, z_top - h),
    ]
    mb.poly([(x, y1 if sign > 0 else y0, z) for x, z in pts], "r2_fret_ochre", ensure_dir=n_dir)
    for (xa, za), (xb, zb) in zip(pts, pts[1:] + pts[:1]):
        mb.quad((xa, y0, za), (xb, y0, zb), (xb, y1, zb), (xa, y1, za), "r2_fret_ochre")
    # Recessed cream/green fret accent inside corner bracket (as visible in hero-2560!)
    yf = (y1 + 0.008) if sign > 0 else (y0 - 0.008)
    mb.box((min(x_pier + x_dir * 0.08, x_pier + x_dir * w * 0.68), min(y0, yf), z_top - h * 0.36),
           (max(x_pier + x_dir * 0.08, x_pier + x_dir * w * 0.68), max(y1, yf), z_top - 0.12), "r2_trim_white")


def _add_pier_brace_strut(mb: R2Mesh, cx: float, z_bot: float, z_top: float, y_face: float, sign: float):
    """Signature diagonal-profile white & green-slotted brace strut (斜撑) supporting lower side eaves."""
    mb.box((cx - 0.10, min(y_face, y_face + sign * 0.38), z_bot),
           (cx + 0.10, max(y_face, y_face + sign * 0.38), z_top), "r2_trim_white")
    mb.box((cx - 0.055, min(y_face + sign * 0.38, y_face + sign * 0.41), z_bot + 0.08),
           (cx + 0.055, max(y_face + sign * 0.38, y_face + sign * 0.41), z_top - 0.08), "r2_fret_green")


def build_beimen(mats: dict, coll: bpy.types.Collection, font=None, target_z: float = 0.0) -> list[bpy.types.Object]:
    G = GATE
    P = G["piers"]
    C = G["central_bay"]
    S = G["side_bay"]
    R = G["roofs"]
    yc, dep = G["centre_y"], G["depth"]
    y0, y1 = yc - dep * 0.5, yc + dep * 0.5

    mb = R2Mesh(mats)
    xi0, xi1 = P["inner"]["x"]
    xo0, xo1 = P["outer"]["x"]

    # 1. Four Cream Stucco Piers with Grey Granite Bases & Golden-Ochre Reveal Bands
    for s in (-1, 1):
        for (pxa, pxb, ptop) in ((s * xi0, s * xi1, P["inner"]["top"]), (s * xo0, s * xo1, P["outer"]["top"])):
            x0, x1 = sorted((pxa, pxb))
            mb.box((x0 - 0.06, y0 - 0.06, target_z), (x1 + 0.06, y1 + 0.06, P["base_h"]), "r2_stone_granite_grey", skip=("-z",))
            mb.box((x0, y0, P["base_h"]), (x1, y1, ptop), "r2_stucco_cream", skip=("-z",))
            for bz in P["bands_z"]:
                if bz + P["band_h"] < ptop - 0.25:
                    mb.box((x0 - 0.018, y0 - 0.018, bz), (x1 + 0.018, y1 + 0.018, bz + P["band_h"]), "r2_fret_ochre")

    # Sculpted vertical oval jade-green medallions (椭圆形绿宝珠花窗) on side struts & outer pier capitals (hero-2560!)
    for s in (-1, 1):
        for mx in (s * (xi1 - 0.22), s * 0.5 * (xo0 + xo1)):
            for sign, yface in ((1, y1), (-1, y0)):
                yb_m = yface + sign * 0.42
                mb.cylinder((mx, yb_m, S["opening_top"] + 0.92), 0.13, 0.13, 0.05, 14, "r2_fret_green")
                mb.box((mx - 0.16, min(yface, yb_m) - 0.01, S["opening_top"] + 0.72), (mx + 0.16, max(yface, yb_m) + 0.01, S["opening_top"] + 1.12), "r2_trim_white")
                mb.box((mx - 0.08, min(yface, yb_m) - 0.02, S["opening_top"] + 0.78), (mx + 0.08, max(yface, yb_m) + 0.02, S["opening_top"] + 1.06), "r2_fret_green")

    # 2. Central Bay Superstructure, Double Fretwork, Plaque Board & Brackets
    zt_c = P["inner"]["top"]
    mb.box((-xi0, y0 + 0.06, C["beam"][0]), (xi0, y1 - 0.06, zt_c), "r2_stucco_cream")
    for sign, yface in ((1, y1 - 0.06), (-1, y0 + 0.06)):
        _add_fretwork_band(mb, -xi0, xi0, C["fret_low"][0], C["fret_low"][1], yface, sign)
        _add_fretwork_band(mb, -xi0 - 0.15, xi0 + 0.15, C["fret_high"][0], C["fret_high"][1], yface, sign)
        px0, px1 = C["plaque_x"]
        pz0, pz1 = C["plaque"]
        yp = yface + sign * 0.05
        # Gold outer border frame + green inner frame line
        mb.box((px0 - 0.08, min(yface, yp), pz0 - 0.08), (px1 + 0.08, max(yface, yp), pz1 + 0.08), "r2_fret_ochre")
        mb.box((px0 - 0.02, min(yface, yp + sign * 0.015), pz0 - 0.02), (px1 + 0.02, max(yface, yp + sign * 0.015), pz1 + 0.02), "r2_fret_green")
        yq = yp + sign * 0.024
        mb.box((px0, min(yface, yq), pz0), (px1, max(yface, yq), pz1), "r2_stucco_cream")
        _add_corner_bracket(mb, -xi0, 1.0, C["opening_top"], C["bracket"]["w"], C["bracket"]["h"], yface, sign)
        _add_corner_bracket(mb, xi0, -1.0, C["opening_top"], C["bracket"]["w"], C["bracket"]["h"], yface, sign)

        # Fluted vertical pilaster capitals on inner attic piers flanking plaque
        for sx in (-1, 1):
            px_c = sx * (xi0 + 0.18)
            mb.box((px_c - 0.14, min(y1 - 0.02, y1 + sign * 0.12) if sign > 0 else min(y0 + 0.02, y0 + sign * 0.12), pz0 + 0.25),
                   (px_c + 0.14, max(y1 - 0.02, y1 + sign * 0.12) if sign > 0 else max(y0 + 0.02, y0 + sign * 0.12), zt_c), "r2_fret_ochre")

    # 3. Side Bays Superstructure, Fretwork & Pier Brace Struts
    for s in (-1, 1):
        xa, xb = sorted((s * xi1, s * xo0))
        mb.box((xa, y0 + 0.09, S["opening_top"]), (xb, y1 - 0.09, P["outer"]["top"] + 0.35), "r2_stucco_cream")
        for sign, yface in ((1, y1 - 0.09), (-1, y0 + 0.09)):
            _add_fretwork_band(mb, xa, xb, S["fret_low"][0], S["fret_low"][1], yface, sign)
            _add_fretwork_band(mb, xa, xb, S["fret_high"][0], S["fret_high"][1], yface, sign)
            _add_corner_bracket(mb, xa, 1.0, S["opening_top"], S["bracket"]["w"], S["bracket"]["h"], yface, sign)
            _add_corner_bracket(mb, xb, -1.0, S["opening_top"], S["bracket"]["w"], S["bracket"]["h"], yface, sign)
        # Outer piers upper fret band + signature diagonal eave struts (斜撑)
        oxa, oxb = sorted((s * xo0, s * xo1))
        for sign, yface in ((1, y1), (-1, y0)):
            _add_fretwork_band(mb, oxa, oxb, S["fret_high"][0], S["fret_high"][1], yface, sign)
            _add_pier_brace_strut(mb, 0.5 * (oxa + oxb), S["opening_top"] + 0.2, R["side"]["eave_z"] + 0.1, yface, sign)
            _add_pier_brace_strut(mb, s * (xi1 - 0.22), S["opening_top"] + 0.2, R["side"]["eave_z"] + 0.1, yface, sign)

    # 4. Three Soaring Emerald Glazed Barrel-Tile Roofs + Eave Bracket Blocks
    rc = R["central"]
    ov_c = rc["eave_y"] - dep * 0.5
    mb.add_lingnan_barrel_roof(
        -(rc["eave_x"] - ov_c), y0, (rc["eave_x"] - ov_c), y1,
        z_eave=rc["eave_z"] + 0.22, pitch_deg=rc["pitch"], overhang=ov_c, concave=0.14, upturn=rc["upturn"],
        tile_mat="r2_roof_emerald", trim_mat="r2_trim_white", soffit_mat="r2_trim_white", tile_pitch=0.23, ridge_h=0.28
    )
    for sign, yface in ((1, y1), (-1, y0)):
        for bx in [(-xi1 + 0.35 + k * 0.68) for k in range(11)]:
            ya, yb = sorted((yface, yface + sign * 0.42))
            mb.box((bx - 0.075, ya, rc["eave_z"] - 0.12), (bx + 0.075, yb, rc["eave_z"] + 0.20), "r2_trim_white")
            mb.box((bx - 0.04, min(yface, yface + sign * 0.25), rc["eave_z"] - 0.22), (bx + 0.04, max(yface, yface + sign * 0.25), rc["eave_z"] - 0.12), "r2_fret_green")

    rs = R["side"]
    ov_s = rs["eave_y"] - dep * 0.5
    for s in (-1, 1):
        xa, xb = sorted((s * (rs["x_in"] + ov_s), s * (rs["x_out"] - ov_s)))
        mb.add_lingnan_barrel_roof(
            xa, y0, xb, y1,
            z_eave=rs["eave_z"] + 0.18, pitch_deg=rs["pitch"], overhang=ov_s, concave=0.14, upturn=rs["upturn"],
            tile_mat="r2_roof_emerald", trim_mat="r2_trim_white", soffit_mat="r2_trim_white", tile_pitch=0.22, ridge_h=0.22
        )

    # 5. Four Sculpted Seated Guardian Stone Lions on Xumi Pedestals
    for i, lx in enumerate(G["lions"]["x"]):
        mb.add_guardian_lion((lx, G["lions"]["y"], target_z), face_dir_y=1.0, mat_name="r2_stone_carved_pale", scale=0.92)

    # 6. Flanking Boundary Walls with Green Glazed Coping + Campus Heritage Notice Board + Side Gatehouses
    for pts_list in (G["walls"]["west"], G["walls"]["east"]):
        for a, b in zip(pts_list[:-1], pts_list[1:]):
            dx, dy = b[0] - a[0], b[1] - a[1]
            L = math.hypot(dx, dy)
            ang = math.atan2(dy, dx)
            xf = Matrix.Translation((a[0], a[1], target_z)) @ Matrix.Rotation(ang, 4, "Z")
            mb.box((0.0, -0.22, 0.0), (L, 0.22, 0.45), "r2_stone_granite_grey", xform=xf)
            mb.box((0.0, -0.18, 0.45), (L, 0.18, G["walls"]["h"]), "r2_stucco_cream", xform=xf)
            mb.add_lingnan_barrel_roof(
                0.0, -0.18, L, 0.18, z_eave=G["walls"]["h"] + 0.05, pitch_deg=26.0, overhang=0.22,
                concave=0.05, upturn=0.0, tile_mat="r2_roof_emerald", trim_mat="r2_trim_white",
                tile_pitch=0.26, ridge_h=0.14, is_gable_x=True, xform=xf
            )
    # Recessed glassed-in school bulletin board on east boundary wall (visible left edge of hero-2560!)
    e0, e1 = G["walls"]["east"][0], G["walls"]["east"][1]
    mx, my = 0.5 * (e0[0] + e1[0]), 0.5 * (e0[1] + e1[1])
    e_ang = math.atan2(e1[1] - e0[1], e1[0] - e0[0])
    xf_b = Matrix.Translation((mx, my, 0.72)) @ Matrix.Rotation(e_ang, 4, "Z")
    mb.box((-1.35, 0.16, 0.0), (1.35, 0.25, 1.32), "r2_mullion_bronze", xform=xf_b)
    mb.box((-1.26, 0.18, 0.08), (1.26, 0.26, 1.24), "r2_glass_window", xform=xf_b)

    # West & East Guard Pavilions / Gatehouses with green glazed hip roofs (hero-2560 right & left edges)
    gh = G["gatehouse"]
    for gx0, gx1 in ((gh["x"][0], gh["x"][1]), (7.35, 12.2)):
        gy0, gy1 = gh["y"]
        mb.box((gx0, gy0, target_z), (gx1, gy1, 0.42), "r2_stone_granite_grey")
        mb.box((gx0 + 0.05, gy0 + 0.05, 0.42), (gx1 - 0.05, gy1 - 0.05, gh["h"]), "r2_stucco_cream")
        mb.box((gx0 + 0.6, gy1 - 0.02, 1.15), (gx1 - 0.6, gy1 + 0.04, 2.35), "r2_glass_window")
        mb.add_lingnan_barrel_roof(
            gx0, gy0, gx1, gy1, z_eave=gh["h"] + 0.05, pitch_deg=30.0, overhang=0.65,
            concave=0.14, upturn=0.35, tile_mat="r2_roof_emerald", trim_mat="r2_trim_white", tile_pitch=0.22
        )

    gate_obj = mb.finalize(
        "beimen_north_gate_r2", coll,
        extras={
            "haiz_building_id": "beimen",
            "haiz_district": "d01_axis_forecourt",
            "haiz_tag": "photo-derived",
            "haiz_basis": "hero-2560.jpg + twin/data/gate.json; Round 2 true barrel-tile paifang, sculpted stone lions, diagonal braces, Songti 3D calligraphy",
            "haiz_name": "北门牌坊（海南中學）",
        }
    )
    objs = [gate_obj]

    # 7. Real Xingkai / Kai 3D Gold Relief Calligraphy Plaque '學中南海' + '一九八八年' small inscription
    pz_mid = 0.5 * (C["plaque"][0] + C["plaque"][1])
    yq_front = y1 - 0.06 + 0.078
    yq_back = y0 + 0.06 - 0.078
    objs.append(pbr_materials.add_cjk_text_object(
        "beimen_plaque_text_n", "學中南海", size=0.86, extrude=0.028, mat=mats["r2_gold_leaf"],
        location=(-0.08, yq_front, pz_mid), rotation_euler=(math.pi * 0.5, 0.0, math.pi),
        collection=coll, font=font
    ))
    objs.append(pbr_materials.add_cjk_text_object(
        "beimen_plaque_date_n", "一\n九\n八\n八\n年", size=0.11, extrude=0.012, mat=mats["r2_gold_leaf"],
        location=(1.88, yq_front, pz_mid - 0.06), rotation_euler=(math.pi * 0.5, 0.0, math.pi),
        collection=coll, font=font
    ))
    objs.append(pbr_materials.add_cjk_text_object(
        "beimen_plaque_text_s", "海南中學", size=0.76, extrude=0.024, mat=mats["r2_gold_leaf"],
        location=(0.0, yq_back, pz_mid), rotation_euler=(math.pi * 0.5, 0.0, 0.0),
        collection=coll, font=font
    ))
    return objs
