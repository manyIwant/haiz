"""
HAIZ World Reconstruction — Parametric Modular Architectural Kit (Pure bpy + bmesh + numpy).

Every architectural component builds real 3D silhouette geometry (curved concave Lingnan
glazed roofs with flying corner eaves, recessed window openings with mullions & sills,
open tropical galleries with floor slabs & handrails, ribbed observatory dome, campus
street furniture) with clean metric UVs so materials tile at exact real-world scale.
"""
from __future__ import annotations

import math
import numpy as np
import bpy
import bmesh
from mathutils import Vector, Matrix


class MeshBuilder:
    """Fast multi-material bmesh builder with automatic metric box/planar UVs."""

    def __init__(self, mats: dict[str, bpy.types.Material]):
        self.mats = mats
        self.mat_list: list[str] = []
        self.mat_index: dict[str, int] = {}
        self.bm = bmesh.new()
        self.uv_layer = self.bm.loops.layers.uv.new("UVMap")

    def mid(self, mat_name: str) -> int:
        if mat_name not in self.mat_index:
            self.mat_index[mat_name] = len(self.mat_list)
            self.mat_list.append(mat_name)
        return self.mat_index[mat_name]

    def add_quad(self, p0, p1, p2, p3, mat_name: str, uv_scale: float = 0.25, explicit_uv=None, ensure_dir: Vector | None = None):
        if ensure_dir is not None:
            e1t = Vector(p1) - Vector(p0)
            e2t = Vector(p3) - Vector(p0)
            if e1t.cross(e2t).dot(ensure_dir) < 0:
                p0, p1, p2, p3 = p0, p3, p2, p1
                if explicit_uv is not None:
                    explicit_uv = [explicit_uv[0], explicit_uv[3], explicit_uv[2], explicit_uv[1]]
        mi = self.mid(mat_name)
        v0 = self.bm.verts.new(p0)
        v1 = self.bm.verts.new(p1)
        v2 = self.bm.verts.new(p2)
        v3 = self.bm.verts.new(p3)
        try:
            f = self.bm.faces.new((v0, v1, v2, v3))
        except ValueError:
            return None
        f.material_index = mi
        if explicit_uv is not None:
            for loop, uv in zip(f.loops, explicit_uv):
                loop[self.uv_layer].uv = uv
        else:
            e1 = Vector(p1) - Vector(p0)
            e2 = Vector(p3) - Vector(p0)
            l1 = e1.length
            l2 = e2.length
            u_dir = e1.normalized() if l1 > 1e-6 else Vector((1, 0, 0))
            nrm = e1.cross(e2)
            v_dir = nrm.cross(u_dir).normalized() if nrm.length > 1e-6 else Vector((0, 1, 0))
            o = Vector(p0)
            for loop in f.loops:
                d = loop.vert.co - o
                loop[self.uv_layer].uv = (d.dot(u_dir) * uv_scale, d.dot(v_dir) * uv_scale)
        return f

    def add_tri(self, p0, p1, p2, mat_name: str, uv_scale: float = 0.25, ensure_dir: Vector | None = None):
        if ensure_dir is not None:
            if (Vector(p1) - Vector(p0)).cross(Vector(p2) - Vector(p0)).dot(ensure_dir) < 0:
                p1, p2 = p2, p1
        mi = self.mid(mat_name)
        v0 = self.bm.verts.new(p0)
        v1 = self.bm.verts.new(p1)
        v2 = self.bm.verts.new(p2)
        try:
            f = self.bm.faces.new((v0, v1, v2))
        except ValueError:
            return None
        f.material_index = mi
        e1 = Vector(p1) - Vector(p0)
        e2 = Vector(p2) - Vector(p0)
        u_dir = e1.normalized() if e1.length > 1e-6 else Vector((1, 0, 0))
        nrm = e1.cross(e2)
        v_dir = nrm.cross(u_dir).normalized() if nrm.length > 1e-6 else Vector((0, 1, 0))
        o = Vector(p0)
        for loop in f.loops:
            d = loop.vert.co - o
            loop[self.uv_layer].uv = (d.dot(u_dir) * uv_scale, d.dot(v_dir) * uv_scale)
        return f

    def add_poly(self, pts: list[tuple[float, float, float]], mat_name: str, uv_scale: float = 0.25, flip: bool = False):
        if len(pts) < 3:
            return None
        # Compute 2D signed area to guarantee strictly upward (+Z) winding unless flip=True
        area2 = sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1] for i in range(len(pts)))
        need_rev = (area2 < 0) != flip
        seq = list(reversed(pts)) if need_rev else pts
        mi = self.mid(mat_name)
        verts = [self.bm.verts.new(p) for p in seq]
        try:
            f = self.bm.faces.new(verts)
        except ValueError:
            return None
        f.material_index = mi
        for loop in f.loops:
            co = loop.vert.co
            loop[self.uv_layer].uv = (co.x * uv_scale, co.y * uv_scale)
        return f

    def add_box(
        self,
        pmin: tuple[float, float, float],
        pmax: tuple[float, float, float],
        mat_name: str,
        uv_scale: float = 0.25,
        skip: tuple[str, ...] = (),
        xform: Matrix | None = None,
    ):
        x0, y0, z0 = pmin
        x1, y1, z1 = pmax
        if x1 <= x0 + 1e-5 or y1 <= y0 + 1e-5 or z1 <= z0 + 1e-5:
            return
        pts = [
            Vector((x0, y0, z0)), Vector((x1, y0, z0)), Vector((x1, y1, z0)), Vector((x0, y1, z0)),
            Vector((x0, y0, z1)), Vector((x1, y0, z1)), Vector((x1, y1, z1)), Vector((x0, y1, z1)),
        ]
        if xform is not None:
            pts = [xform @ p for p in pts]
        faces = [
            ("-z", (0, 3, 2, 1)),
            ("+z", (4, 5, 6, 7)),
            ("-y", (0, 1, 5, 4)),
            ("+y", (2, 3, 7, 6)),
            ("-x", (3, 0, 4, 7)),
            ("+x", (1, 2, 6, 5)),
        ]
        for key, (a, b, c, d) in faces:
            if key in skip:
                continue
            self.add_quad(pts[a], pts[b], pts[c], pts[d], mat_name, uv_scale)

    def add_cylinder(
        self,
        center: tuple[float, float],
        r_bot: float,
        r_top: float,
        z0: float,
        z1: float,
        mat_name: str,
        segs: int = 12,
        caps: tuple[bool, bool] = (False, True),
        uv_scale: float = 0.35,
        xform: Matrix | None = None,
    ):
        cx, cy = center
        bot = []
        top = []
        for i in range(segs):
            a = i * 2.0 * math.pi / segs
            ca, sa = math.cos(a), math.sin(a)
            pb = Vector((cx + r_bot * ca, cy + r_bot * sa, z0))
            pt = Vector((cx + r_top * ca, cy + r_top * sa, z1))
            if xform is not None:
                pb = xform @ pb
                pt = xform @ pt
            bot.append(pb)
            top.append(pt)
        for i in range(segs):
            j = (i + 1) % segs
            self.add_quad(bot[i], bot[j], top[j], top[i], mat_name, uv_scale)
        if caps[0]:
            self.add_poly(list(reversed(bot)), mat_name, uv_scale)
        if caps[1]:
            self.add_poly(top, mat_name, uv_scale)

    def add_curved_hip_roof(
        self,
        x0: float,
        y0: float,
        x1: float,
        y1: float,
        z_eave: float,
        pitch_deg: float = 28.0,
        overhang: float = 1.0,
        concave: float = 0.14,
        upturn: float = 0.42,
        tile_mat: str = "mat_roof_terracotta",
        trim_mat: str = "mat_trim_white",
        segs_slope: int = 4,
        xform: Matrix | None = None,
    ):
        """
        Lingnan/Nanyang curved concave hipped roof with sweeping upturned corner eaves,
        white fascia soffits, prominent ridges, and curled ridge ends.
        """
        ex0, ey0 = x0 - overhang, y0 - overhang
        ex1, ey1 = x1 + overhang, y1 + overhang
        W = ex1 - ex0
        D = ey1 - ey0
        cx, cy = 0.5 * (ex0 + ex1), 0.5 * (ey0 + ey1)
        slope = math.tan(math.radians(pitch_deg))

        if W >= D:
            ridge_half = max(0.0, 0.5 * (W - D))
            rise = 0.5 * D * slope
            rx0, rx1 = cx - ridge_half, cx + ridge_half
            ry0 = ry1 = cy
            along_x = True
        else:
            ridge_half = max(0.0, 0.5 * (D - W))
            rise = 0.5 * W * slope
            rx0 = rx1 = cx
            ry0, ry1 = cy - ridge_half, cy + ridge_half
            along_x = False

        def tf(p: Vector) -> Vector:
            return xform @ p if xform is not None else p

        def corner_lift(px: float, py: float) -> float:
            # Lift near the 4 eave corners smoothly
            dx = min(abs(px - ex0), abs(px - ex1))
            dy = min(abs(py - ey0), abs(py - ey1))
            dist = math.hypot(dx, dy)
            span = min(3.0, min(W, D) * 0.35)
            t = max(0.0, 1.0 - dist / max(span, 0.5))
            return upturn * (t * t)

        def eval_slope(p_eave: Vector, p_ridge: Vector, t: float) -> Vector:
            p = p_eave.lerp(p_ridge, t)
            # Concave sag in middle + corner upturn near eave (t -> 0)
            sag = -concave * rise * math.sin(t * math.pi)
            lift = corner_lift(p.x, p.y) * ((1.0 - t) ** 2.2)
            p.z = z_eave + rise * t + sag + lift
            return p

        # Build 4 trapezoidal/triangular hip slopes with subdivided concave grid
        c_sw = Vector((ex0, ey0, z_eave))
        c_se = Vector((ex1, ey0, z_eave))
        c_ne = Vector((ex1, ey1, z_eave))
        c_nw = Vector((ex0, ey1, z_eave))
        r0 = Vector((rx0, ry0, z_eave + rise))
        r1 = Vector((rx1, ry1, z_eave + rise))

        if along_x:
            slopes = [
                (c_sw, c_se, r0, r1, 6),  # South slope
                (c_ne, c_nw, r1, r0, 6),  # North slope
                (c_se, c_ne, r1, r1, 4),  # East hip
                (c_nw, c_sw, r0, r0, 4),  # West hip
            ]
        else:
            slopes = [
                (c_se, c_ne, r0, r1, 6),  # East slope
                (c_nw, c_sw, r1, r0, 6),  # West slope
                (c_ne, c_nw, r1, r1, 4),  # North hip
                (c_sw, c_se, r0, r0, 4),  # South hip
            ]

        up_vec = Vector((0, 0, 1))
        for ea, eb, ra, rb, nu in slopes:
            grid = []
            for j in range(segs_slope + 1):
                tj = j / segs_slope
                row = []
                for i in range(nu + 1):
                    ti = i / nu
                    pe = ea.lerp(eb, ti)
                    pr = ra.lerp(rb, ti)
                    row.append(tf(eval_slope(pe, pr, tj)))
                grid.append(row)
            for j in range(segs_slope):
                for i in range(nu):
                    p00 = grid[j][i]
                    p10 = grid[j][i + 1]
                    p11 = grid[j + 1][i + 1]
                    p01 = grid[j + 1][i]
                    if (p11 - p01).length < 1e-4:
                        self.add_tri(p00, p10, p01, tile_mat, uv_scale=0.38, ensure_dir=up_vec)
                    else:
                        self.add_quad(p00, p10, p11, p01, tile_mat, uv_scale=0.38, ensure_dir=up_vec)
            # Crisp white fascia board & underside soffit along the eave edge
            fascia_h = 0.24
            eave_out = (ea.lerp(eb, 0.5) - Vector((cx, cy, z_eave)))
            eave_out.z = 0
            eave_out_w = (tf(eave_out) - tf(Vector((0, 0, 0)))).normalized() if eave_out.length > 1e-4 else Vector((0, 1, 0))
            for i in range(nu):
                a0 = grid[0][i]
                a1 = grid[0][i + 1]
                b0 = a0 - (tf(Vector((0, 0, fascia_h))) - tf(Vector((0, 0, 0))))
                b1 = a1 - (tf(Vector((0, 0, fascia_h))) - tf(Vector((0, 0, 0))))
                self.add_quad(b0, b1, a1, a0, trim_mat, uv_scale=0.5, ensure_dir=eave_out_w)

        # Soffit flat closing plane under eaves (facing downward -Z)
        so = z_eave - 0.22
        self.add_quad(
            tf(Vector((ex0, ey0, so))), tf(Vector((ex0, ey1, so))),
            tf(Vector((ex1, ey1, so))), tf(Vector((ex1, ey0, so))),
            trim_mat, uv_scale=0.25, ensure_dir=Vector((0, 0, -1))
        )

        # Raised white/ceramic main ridge & upturned finials
        rw = 0.22
        rh = 0.30
        if along_x:
            self.add_box((rx0 - 0.15, cy - rw, z_eave + rise - 0.05), (rx1 + 0.15, cy + rw, z_eave + rise + rh), trim_mat, xform=xform)
            for rx_end in (rx0 - 0.22, rx1 + 0.22):
                self.add_box((rx_end - 0.18, cy - rw * 1.1, z_eave + rise), (rx_end + 0.18, cy + rw * 1.1, z_eave + rise + rh + 0.28), trim_mat, xform=xform)
        else:
            self.add_box((cx - rw, ry0 - 0.15, z_eave + rise - 0.05), (cx + rw, ry1 + 0.15, z_eave + rise + rh), trim_mat, xform=xform)
            for ry_end in (ry0 - 0.22, ry1 + 0.22):
                self.add_box((cx - rw * 1.1, ry_end - 0.18, z_eave + rise), (cx + rw * 1.1, ry_end + 0.18, z_eave + rise + rh + 0.28), trim_mat, xform=xform)

        # Four diagonal hip ridges
        hip_pairs = [(c_sw, r0), (c_se, r1 if along_x else r0), (c_ne, r1), (c_nw, r0 if along_x else r1)]
        for ce, re in hip_pairs:
            prev = None
            for k in range(5):
                tk = k / 4.0
                pt = eval_slope(ce, re, tk)
                if prev is not None:
                    d = pt - prev
                    seg_len = d.length
                    if seg_len > 1e-4:
                        side = Vector((-d.y, d.x, 0)).normalized() * 0.11
                        up = Vector((0, 0, 0.16))
                        self.add_quad(tf(prev - side), tf(pt - side), tf(pt - side + up), tf(prev - side + up), trim_mat)
                        self.add_quad(tf(pt + side), tf(prev + side), tf(prev + side + up), tf(pt + side + up), trim_mat)
                        self.add_quad(tf(prev - side + up), tf(pt - side + up), tf(pt + side + up), tf(prev + side + up), trim_mat)
                prev = pt

    def add_pavilion_roof(
        self,
        cx: float,
        cy: float,
        half_span: float,
        z_eave: float,
        rise: float = 2.4,
        upturn: float = 0.55,
        tile_mat: str = "mat_roof_emerald",
        trim_mat: str = "mat_trim_white",
        vermilion_mat: str = "mat_paint_vermilion",
    ):
        """Square pyramidal Lingnan pavilion roof with dramatic soaring corner eaves & spire finial."""
        self.add_curved_hip_roof(
            cx - half_span * 0.72, cy - half_span * 0.72,
            cx + half_span * 0.72, cy + half_span * 0.72,
            z_eave=z_eave, pitch_deg=math.degrees(math.atan2(rise, half_span)),
            overhang=half_span * 0.28, concave=0.22, upturn=upturn,
            tile_mat=tile_mat, trim_mat=vermilion_mat, segs_slope=5
        )
        # Emerald glazed lotus finial spire at apex
        apex_z = z_eave + rise
        self.add_cylinder((cx, cy), 0.24, 0.14, apex_z - 0.1, apex_z + 0.35, tile_mat, segs=10)
        self.add_cylinder((cx, cy), 0.18, 0.04, apex_z + 0.35, apex_z + 0.85, tile_mat, segs=10)

    def add_recessed_window_bay(
        self,
        origin: Vector,
        u_dir: Vector,
        out_dir: Vector,
        bay_w: float,
        floor_h: float,
        win_w: float,
        win_h: float,
        sill_h: float = 0.9,
        recess: float = 0.22,
        wall_mat: str = "mat_wall_ivory",
        glass_mat: str = "mat_glass_classroom",
        frame_mat: str = "mat_metal_dark",
        sill_mat: str = "mat_trim_white",
        mullions: int = 2,
        lod: int = 0,
    ):
        """
        Build a single architectural wall bay with true 3D recessed window reveal,
        sill projection, transom & vertical mullions (LOD0) or clean flush glazed bay (LOD1).
        """
        up = Vector((0, 0, 1))
        hw = bay_w * 0.5
        ww = min(win_w, bay_w - 0.36) * 0.5
        z0 = 0.0
        z_sill = sill_h
        z_head = min(sill_h + win_h, floor_h - 0.24)
        z_top = floor_h

        def pt(u: float, n: float, z: float) -> Vector:
            return origin + u_dir * u + out_dir * n + up * z

        # Spandrel below sill
        self.add_quad(pt(-hw, 0, z0), pt(hw, 0, z0), pt(hw, 0, z_sill), pt(-hw, 0, z_sill), wall_mat, ensure_dir=out_dir)
        # Header above window
        self.add_quad(pt(-hw, 0, z_head), pt(hw, 0, z_head), pt(hw, 0, z_top), pt(-hw, 0, z_top), wall_mat, ensure_dir=out_dir)
        # Left & right piers
        self.add_quad(pt(-hw, 0, z_sill), pt(-ww, 0, z_sill), pt(-ww, 0, z_head), pt(-hw, 0, z_head), wall_mat, ensure_dir=out_dir)
        self.add_quad(pt(ww, 0, z_sill), pt(hw, 0, z_sill), pt(hw, 0, z_head), pt(ww, 0, z_head), wall_mat, ensure_dir=out_dir)

        if lod >= 1:
            # Simplified LOD1: glass inset slightly without jambs/mullions
            self.add_quad(pt(-ww, -0.04, z_sill), pt(ww, -0.04, z_sill), pt(ww, -0.04, z_head), pt(-ww, -0.04, z_head), glass_mat, uv_scale=0.5, ensure_dir=out_dir)
            return

        # True 3D recessed jambs, sill, soffit
        self.add_quad(pt(-ww, -recess, z_sill), pt(-ww, 0, z_sill), pt(-ww, 0, z_head), pt(-ww, -recess, z_head), wall_mat, ensure_dir=u_dir)
        self.add_quad(pt(ww, 0, z_sill), pt(ww, -recess, z_sill), pt(ww, -recess, z_head), pt(ww, 0, z_head), wall_mat, ensure_dir=-u_dir)
        self.add_quad(pt(-ww, 0, z_head), pt(ww, 0, z_head), pt(ww, -recess, z_head), pt(-ww, -recess, z_head), wall_mat, ensure_dir=-up)
        self.add_quad(pt(-ww, -recess, z_sill), pt(ww, -recess, z_sill), pt(ww, 0.08, z_sill), pt(-ww, 0.08, z_sill), sill_mat, ensure_dir=up)
        # Projecting sill lip
        self.add_quad(pt(-ww - 0.06, 0.08, z_sill - 0.07), pt(ww + 0.06, 0.08, z_sill - 0.07), pt(ww + 0.06, 0.08, z_sill), pt(-ww - 0.06, 0.08, z_sill), sill_mat, ensure_dir=out_dir)

        # Recessed glazing plane
        self.add_quad(pt(-ww, -recess, z_sill), pt(ww, -recess, z_sill), pt(ww, -recess, z_head), pt(-ww, -recess, z_head), glass_mat, uv_scale=0.5, ensure_dir=out_dir)

        # Transom bar + vertical mullions sitting proud of glass
        fn = -recess + 0.04
        z_trans = z_head - (z_head - z_sill) * 0.26
        self.add_quad(pt(-ww, fn, z_trans - 0.03), pt(ww, fn, z_trans - 0.03), pt(ww, fn, z_trans + 0.03), pt(-ww, fn, z_trans + 0.03), frame_mat, ensure_dir=out_dir)
        for m in range(1, mullions + 1):
            um = -ww + (2.0 * ww) * (m / (mullions + 1))
            self.add_quad(pt(um - 0.028, fn, z_sill), pt(um + 0.028, fn, z_sill), pt(um + 0.028, fn, z_head), pt(um - 0.028, fn, z_head), frame_mat, ensure_dir=out_dir)

    def add_polygon_building(
        self,
        poly: list[list[float]],
        z0: float,
        floors: int,
        storey_h: float,
        wall_mat: str = "mat_wall_ivory",
        plinth_mat: str | None = None,
        roof_style: str = "flat_parapet",
        archetype: str = "tropical_academic_gallery",
        lod: int = 0,
    ):
        """
        Parametric multi-storey tropical building generator from ANY real OSM polygon!
        Produces recessed window rhythms, horizontal floor slabs, cantilevered open galleries,
        parapet crowns, or pitched terracotta/emerald Lingnan roofs depending on archetype.
        """
        n = len(poly)
        if n < 3:
            return
        total_h = floors * storey_h
        z_top = z0 + total_h

        # Ground base plinth
        plinth_h = 0.45
        z_start = z0 + plinth_h
        for i in range(n):
            a = poly[i]
            b = poly[(i + 1) % n]
            dx, dy = b[0] - a[0], b[1] - a[1]
            L = math.hypot(dx, dy)
            if L < 0.25:
                continue
            u = Vector((dx / L, dy / L, 0.0))
            out = Vector((dy / L, -dx / L, 0.0))  # outward normal for CCW poly

            # Plinth strip
            p0 = Vector((a[0], a[1], z0))
            p1 = Vector((b[0], b[1], z0))
            self.add_quad(p0, p1, p1 + Vector((0, 0, plinth_h)), p0 + Vector((0, 0, plinth_h)), plinth_mat or "mat_stone_granite_grey")

            # Determine facade treatment for this edge
            is_long = L >= 10.0
            has_gallery = (archetype in ("tropical_academic_gallery", "science_hall", "coral_courtyard_academic") and is_long and lod == 0)
            bay_target = 3.8 if archetype == "tropical_dorm_slab" else 4.4
            nbays = max(1, int(round(L / bay_target)))
            bay_w = L / nbays

            if L < 3.0 or lod >= 1:
                # Clean continuous facade with window bands on LOD1 or short return walls
                for f in range(floors):
                    zf = z_start + f * storey_h
                    w_mat = plinth_mat if (plinth_mat and f == 0) else wall_mat
                    if L >= 4.2:
                        for bi in range(nbays):
                            orig = Vector((a[0], a[1], zf)) + u * ((bi + 0.5) * bay_w)
                            self.add_recessed_window_bay(
                                orig, u, out, bay_w, storey_h, bay_w * 0.62, storey_h * 0.56,
                                sill_h=0.95, wall_mat=w_mat, lod=1
                            )
                    else:
                        v0 = Vector((a[0], a[1], zf))
                        v1 = Vector((b[0], b[1], zf))
                        self.add_quad(v0, v1, v1 + Vector((0, 0, storey_h)), v0 + Vector((0, 0, storey_h)), w_mat)
            else:
                for f in range(floors):
                    zf = z_start + f * storey_h
                    w_mat = plinth_mat if (plinth_mat and f == 0) else wall_mat
                    # Ground-floor open shaded colonnade for canteens & teaching blocks
                    if f == 0 and archetype in ("campus_canteen", "tropical_academic_gallery") and is_long:
                        inset = 1.6
                        for bi in range(nbays):
                            orig = Vector((a[0], a[1], zf)) + u * ((bi + 0.5) * bay_w) - out * inset
                            self.add_recessed_window_bay(
                                orig, u, out, bay_w, storey_h, bay_w * 0.70, storey_h * 0.68,
                                sill_h=0.55, wall_mat=w_mat, lod=0
                            )
                            # Exterior structural pier along facade line
                            pc = Vector((a[0], a[1], zf)) + u * (bi * bay_w) - out * 0.35
                            self.add_box(
                                (-0.28, -0.28, 0.0), (0.28, 0.28, storey_h),
                                "mat_trim_white",
                                xform=Matrix.Translation(pc) @ Matrix.Rotation(math.atan2(u.y, u.x), 4, "Z")
                            )
                        # Soffit slab above colonnade
                        c0 = Vector((a[0], a[1], zf + storey_h - 0.18))
                        c1 = Vector((b[0], b[1], zf + storey_h - 0.18))
                        self.add_quad(c0 - out * inset, c1 - out * inset, c1, c0, "mat_trim_white")
                    else:
                        win_ratio = 0.58 if archetype == "tropical_dorm_slab" else 0.66
                        recess = 0.55 if archetype == "tropical_dorm_slab" else 0.24
                        for bi in range(nbays):
                            orig = Vector((a[0], a[1], zf)) + u * ((bi + 0.5) * bay_w)
                            self.add_recessed_window_bay(
                                orig, u, out, bay_w, storey_h, bay_w * win_ratio, storey_h * 0.58,
                                sill_h=0.92, recess=recess, wall_mat=w_mat, mullions=2 if bay_w > 3.2 else 1, lod=0
                            )

                    # Cantilevered tropical white gallery slab + horizontal handrail
                    if has_gallery and f >= 1:
                        slab_d = 1.15 if archetype == "science_hall" else 0.85
                        s0 = Vector((a[0], a[1], zf))
                        s1 = Vector((b[0], b[1], zf))
                        # Slab edge & top/bottom
                        self.add_quad(s0 + out * slab_d, s1 + out * slab_d, s1 + out * slab_d + Vector((0, 0, 0.24)), s0 + out * slab_d + Vector((0, 0, 0.24)), "mat_trim_white")
                        self.add_quad(s0 + Vector((0, 0, 0.24)), s1 + Vector((0, 0, 0.24)), s1 + out * slab_d + Vector((0, 0, 0.24)), s0 + out * slab_d + Vector((0, 0, 0.24)), "mat_trim_white")
                        self.add_quad(s0 + out * slab_d, s0, s1, s1 + out * slab_d, "mat_trim_white")
                        # Parapet/railing band (offsets relative to s0/s1 which already sit at z = zf!)
                        rail_mat = "mat_trim_white" if archetype == "science_hall" else "mat_metal_dark"
                        if archetype == "science_hall":
                            self.add_quad(s0 + out * slab_d + Vector((0, 0, 0.24)), s1 + out * slab_d + Vector((0, 0, 0.24)),
                                          s1 + out * slab_d + Vector((0, 0, 0.92)), s0 + out * slab_d + Vector((0, 0, 0.92)), "mat_wall_ivory")
                        else:
                            self.add_quad(s0 + out * (slab_d - 0.05) + Vector((0, 0, 0.97)), s1 + out * (slab_d - 0.05) + Vector((0, 0, 0.97)),
                                          s1 + out * (slab_d - 0.05) + Vector((0, 0, 1.05)), s0 + out * (slab_d - 0.05) + Vector((0, 0, 1.05)), rail_mat)

            # Subtle horizontal cornice band at roof line
            top0 = Vector((a[0], a[1], z_top + plinth_h))
            top1 = Vector((b[0], b[1], z_top + plinth_h))
            self.add_quad(top0 + out * 0.28, top1 + out * 0.28, top1 + out * 0.28 + Vector((0, 0, 0.35)), top0 + out * 0.28 + Vector((0, 0, 0.35)), "mat_trim_white")

        # Roof cap & parapet
        z_roof = z_top + plinth_h
        top_pts = [(p[0], p[1], z_roof) for p in poly]
        self.add_poly(top_pts, "mat_roof_flat", uv_scale=0.12)

        if roof_style in ("flat_parapet", "flat_parapet_crown"):
            par_h = 0.95
            for i in range(n):
                a = poly[i]
                b = poly[(i + 1) % n]
                v0 = Vector((a[0], a[1], z_roof))
                v1 = Vector((b[0], b[1], z_roof))
                self.add_quad(v0, v1, v1 + Vector((0, 0, par_h)), v0 + Vector((0, 0, par_h)), "mat_trim_white")
                self.add_quad(v1, v0, v0 + Vector((0, 0, par_h)), v1 + Vector((0, 0, par_h)), "mat_roof_flat")
            if roof_style == "flat_parapet_crown":
                # Rooftop stair/equipment penthouse (observed on campus_kexue.jpg)
                cx = sum(p[0] for p in poly) / n
                cy = sum(p[1] for p in poly) / n
                self.add_box((cx - 8.5, cy - 4.2, z_roof), (cx + 8.5, cy + 4.2, z_roof + 3.4), "mat_wall_ivory", skip=("-z",))
                self.add_box((cx - 9.2, cy - 4.8, z_roof + 3.4), (cx + 9.2, cy + 4.8, z_roof + 3.85), "mat_trim_white")
        elif roof_style in ("terracotta_lingnan_hip", "emerald_lingnan_hip"):
            xs = [p[0] for p in poly]
            ys = [p[1] for p in poly]
            tmat = "mat_roof_terracotta" if "terracotta" in roof_style else "mat_roof_emerald"
            self.add_curved_hip_roof(
                min(xs) + 0.4, min(ys) + 0.4, max(xs) - 0.4, max(ys) - 0.4,
                z_eave=z_roof + 0.1, pitch_deg=24.0, overhang=1.1, concave=0.08, upturn=0.35,
                tile_mat=tmat, trim_mat="mat_trim_white"
            )
        elif roof_style == "vaulted_metal":
            # Modern Gymnasium vaulted barrel roof with clerestory skylight rib
            xs = [p[0] for p in poly]
            ys = [p[1] for p in poly]
            x0, x1, y0, y1 = min(xs) - 0.8, max(xs) + 0.8, min(ys) - 0.8, max(ys) + 0.8
            segs = 10
            arch_h = 3.8
            for k in range(segs):
                t0 = k / segs
                t1 = (k + 1) / segs
                ax0 = x0 + (x1 - x0) * t0
                ax1 = x0 + (x1 - x0) * t1
                az0 = z_roof + arch_h * math.sin(t0 * math.pi)
                az1 = z_roof + arch_h * math.sin(t1 * math.pi)
                mat_seg = "mat_glass_turquoise" if (k in (4, 5)) else "mat_metal_silver"
                self.add_quad((ax0, y0, az0), (ax1, y0, az1), (ax1, y1, az1), (ax0, y1, az0), mat_seg, uv_scale=0.18)
                # Gable end fills
                self.add_quad((ax0, y0, z_roof), (ax1, y0, z_roof), (ax1, y0, az1), (ax0, y0, az0), "mat_wall_ivory")
                self.add_quad((ax1, y1, z_roof), (ax0, y1, z_roof), (ax0, y1, az0), (ax1, y1, az1), "mat_wall_ivory")

    def finalize(self, name: str, collection: bpy.types.Collection, extras: dict | None = None, smooth: bool = False) -> bpy.types.Object:
        # Preserve exact authored outward winding (do NOT run recalc_face_normals on unmerged faces!)
        if smooth:
            for f in self.bm.faces:
                f.smooth = True
        mesh = bpy.data.meshes.new(name)
        self.bm.to_mesh(mesh)
        self.bm.free()
        for mname in self.mat_list:
            mesh.materials.append(self.mats[mname])
        mesh.update()
        obj = bpy.data.objects.new(name, mesh)
        collection.objects.link(obj)
        if extras:
            for k, v in extras.items():
                obj[k] = v
        return obj
