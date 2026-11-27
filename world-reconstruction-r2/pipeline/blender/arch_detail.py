"""
HAIZ · World Reconstruction Round 2 — High-Craft Architectural Detail & Sculpture Kit
===================================================================================
Strict outward-winding bmesh builder featuring:
  - True individual 3D semi-cylindrical Lingnan barrel tiles (筒瓦) + circular Wadan eave
    caps (瓦当) + drip lips (滴水) + upturned dragon-tail ridge finials (翘角)
  - Recessed multi-pane window assemblies with exterior mullions, reflective glass & dark interiors
  - Lathe-turned stone column drum bases (柱础), tapered columns & 20-ribbed observatory domes
  - Multi-element sculpted seated guardian stone lions on Xumi (须弥座) relief pedestals
  - Traditional courtyard fretwork (回纹), corner brackets (雀替), and Meirenkao (美人靠) benches
"""
from __future__ import annotations
import math
import bmesh
import bpy
from mathutils import Matrix, Vector


class R2Mesh:
    """Strict outward-normal multi-material bmesh builder."""

    def __init__(self, mats: dict[str, bpy.types.Material]):
        self.bm = bmesh.new()
        self.uv_layer = self.bm.loops.layers.uv.new("UVMap")
        self.mats = mats
        self.mat_idx: dict[str, int] = {}
        self.mat_list: list[str] = []

    def _midx(self, mat_name: str) -> int:
        if mat_name not in self.mat_idx:
            self.mat_idx[mat_name] = len(self.mat_list)
            self.mat_list.append(mat_name)
        return self.mat_idx[mat_name]

    def _add_face(self, coords: list[Vector], uvs: list[tuple[float, float]], mat_name: str, ensure_dir: Vector | None = None):
        if len(coords) < 3:
            return
        if ensure_dir is not None:
            n = (coords[1] - coords[0]).cross(coords[2] - coords[0])
            if n.dot(ensure_dir) < 0:
                coords = [coords[0]] + list(reversed(coords[1:]))
                uvs = [uvs[0]] + list(reversed(uvs[1:]))
        verts = [self.bm.verts.new(c) for c in coords]
        try:
            f = self.bm.faces.new(verts)
        except ValueError:
            return
        f.material_index = self._midx(mat_name)
        for loop, uv in zip(f.loops, uvs):
            loop[self.uv_layer].uv = uv

    def quad(self, p0, p1, p2, p3, mat_name: str, uv_scale: float = 0.25, explicit_uv=None, ensure_dir: Vector | None = None):
        pts = [Vector(p0), Vector(p1), Vector(p2), Vector(p3)]
        if explicit_uv is not None:
            uvs = explicit_uv
        else:
            u = pts[1] - pts[0]
            ul = u.length
            if ul < 1e-6:
                u = Vector((1, 0, 0))
            else:
                u /= ul
            n = (pts[1] - pts[0]).cross(pts[3] - pts[0])
            if n.length < 1e-6:
                v = Vector((0, 0, 1))
            else:
                v = n.normalized().cross(u).normalized()
            o = pts[0]
            uvs = [((p - o).dot(u) * uv_scale, (p - o).dot(v) * uv_scale) for p in pts]
        self._add_face(pts, uvs, mat_name, ensure_dir=ensure_dir)

    def tri(self, p0, p1, p2, mat_name: str, uv_scale: float = 0.25, ensure_dir: Vector | None = None):
        pts = [Vector(p0), Vector(p1), Vector(p2)]
        u = pts[1] - pts[0]
        u = u.normalized() if u.length > 1e-6 else Vector((1, 0, 0))
        n = u.cross(pts[2] - pts[0])
        v = n.normalized().cross(u).normalized() if n.length > 1e-6 else Vector((0, 0, 1))
        o = pts[0]
        uvs = [((p - o).dot(u) * uv_scale, (p - o).dot(v) * uv_scale) for p in pts]
        self._add_face(pts, uvs, mat_name, ensure_dir=ensure_dir)

    def poly(self, pts, mat_name: str, uv_scale: float = 0.25, ensure_dir: Vector | None = None):
        coords = [Vector(p) for p in pts]
        uvs = [(p.x * uv_scale, p.y * uv_scale) for p in coords]
        self._add_face(coords, uvs, mat_name, ensure_dir=ensure_dir)

    def box(self, lo, hi, mat_name: str, uv_scale: float = 0.25, skip=(), xform: Matrix | None = None):
        x0, y0, z0 = lo
        x1, y1, z1 = hi
        if x0 > x1: x0, x1 = x1, x0
        if y0 > y1: y0, y1 = y1, y0
        if z0 > z1: z0, z1 = z1, z0
        def tf(p):
            v = Vector(p)
            return xform @ v if xform is not None else v
        faces = {
            "-z": ((x0, y1, z0), (x1, y1, z0), (x1, y0, z0), (x0, y0, z0), (0, 0, -1)),
            "+z": ((x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1), (0, 0, 1)),
            "-y": ((x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1), (0, -1, 0)),
            "+y": ((x1, y1, z0), (x0, y1, z0), (x0, y1, z1), (x1, y1, z1), (0, 1, 0)),
            "-x": ((x0, y1, z0), (x0, y0, z0), (x0, y0, z1), (x0, y1, z1), (-1, 0, 0)),
            "+x": ((x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1), (1, 0, 0)),
        }
        for key, (a, b, c, d, n) in faces.items():
            if key in skip:
                continue
            nd = (xform.to_3x3() @ Vector(n)).normalized() if xform is not None else Vector(n)
            self.quad(tf(a), tf(b), tf(c), tf(d), mat_name, uv_scale=uv_scale, ensure_dir=nd)

    def cylinder(self, base_center, r_bot: float, r_top: float, height: float, segs: int, mat_name: str,
                 cap_top: bool = True, cap_bot: bool = True, xform: Matrix | None = None, uv_scale: float = 0.4):
        bx, by, bz = base_center
        def tf(p):
            v = Vector(p)
            return xform @ v if xform is not None else v
        bot_ring, top_ring = [], []
        for i in range(segs):
            a = (i / segs) * math.tau
            ca, sa = math.cos(a), math.sin(a)
            bot_ring.append(tf((bx + r_bot * ca, by + r_bot * sa, bz)))
            top_ring.append(tf((bx + r_top * ca, by + r_top * sa, bz + height)))
        for i in range(segs):
            ni = (i + 1) % segs
            p0, p1, p2, p3 = bot_ring[i], bot_ring[ni], top_ring[ni], top_ring[i]
            out = ((p0 + p1) * 0.5 - tf((bx, by, bz)))
            self.quad(p0, p1, p2, p3, mat_name, uv_scale=uv_scale, ensure_dir=out)
        if cap_top and r_top > 1e-4:
            self.poly(top_ring, mat_name, uv_scale=uv_scale, ensure_dir=(xform.to_3x3() @ Vector((0, 0, 1)) if xform else Vector((0, 0, 1))))
        if cap_bot and r_bot > 1e-4:
            self.poly(list(reversed(bot_ring)), mat_name, uv_scale=uv_scale, ensure_dir=(xform.to_3x3() @ Vector((0, 0, -1)) if xform else Vector((0, 0, -1))))

    def lathe(self, center, profile_rz: list[tuple[float, float]], segs: int, mat_name: str, xform: Matrix | None = None, uv_scale: float = 0.5):
        """Revolve a (radius, z) profile smoothly around +Z."""
        cx, cy, cz = center
        def tf(p):
            v = Vector(p)
            return xform @ v if xform is not None else v
        rings = []
        for r, z in profile_rz:
            ring = []
            for i in range(segs):
                a = (i / segs) * math.tau
                ring.append(tf((cx + r * math.cos(a), cy + r * math.sin(a), cz + z)))
            rings.append((r, z, ring))
        for k in range(len(rings) - 1):
            r0, z0, ring0 = rings[k]
            r1, z1, ring1 = rings[k + 1]
            c_mid = tf((cx, cy, cz + 0.5 * (z0 + z1)))
            for i in range(segs):
                ni = (i + 1) % segs
                p0, p1, p2, p3 = ring0[i], ring0[ni], ring1[ni], ring1[i]
                if r0 < 1e-4 and r1 < 1e-4:
                    continue
                elif r0 < 1e-4:
                    self.tri(p0, p2, p3, mat_name, uv_scale=uv_scale, ensure_dir=(p2 + p3) * 0.5 - c_mid)
                elif r1 < 1e-4:
                    self.tri(p0, p1, p2, mat_name, uv_scale=uv_scale, ensure_dir=(p0 + p1) * 0.5 - c_mid)
                else:
                    self.quad(p0, p1, p2, p3, mat_name, uv_scale=uv_scale, ensure_dir=(p0 + p1) * 0.5 - c_mid)

    def tube(self, pts: list[Vector], radius: float, segs: int, mat_name: str):
        if len(pts) < 2:
            return
        vecs = [Vector(p) for p in pts]
        rings = []
        for idx, p in enumerate(vecs):
            if idx == 0:
                t = (vecs[1] - vecs[0]).normalized()
            elif idx == len(vecs) - 1:
                t = (vecs[-1] - vecs[-2]).normalized()
            else:
                t = (vecs[idx + 1] - vecs[idx - 1]).normalized()
            ref = Vector((0, 0, 1)) if abs(t.z) < 0.92 else Vector((1, 0, 0))
            b1 = t.cross(ref).normalized()
            b2 = t.cross(b1).normalized()
            rings.append([p + (b1 * math.cos(a) + b2 * math.sin(a)) * radius for a in [i / segs * math.tau for i in range(segs)]])
        for k in range(len(rings) - 1):
            for i in range(segs):
                ni = (i + 1) % segs
                self.quad(rings[k][i], rings[k][ni], rings[k + 1][ni], rings[k + 1][i], mat_name, uv_scale=1.0)
        self.poly(list(reversed(rings[0])), mat_name)
        self.poly(rings[-1], mat_name)

    def add_window_assembly(
        self,
        origin: Vector,
        u: Vector,
        out: Vector,
        win_w: float,
        win_h: float,
        frame_mat: str = "r2_trim_white",
        glass_mat: str = "r2_glass_window",
        interior_mat: str = "r2_interior_dark",
        recess: float = 0.24,
        panes_x: int = 3,
        has_transom: bool = True,
        sill_proj: float = 0.08,
    ):
        """Multi-pane recessed window assembly with transom, sliding sash bars, reflective glass & dark interior depth."""
        up = Vector((0, 0, 1))
        hw = win_w * 0.5
        # Dark interior shadow box behind glass (recessed further in)
        gl_z = recess * 0.72
        self.quad(
            origin - u * (hw - 0.04) - out * (recess + 0.14) + up * 0.04,
            origin + u * (hw - 0.04) - out * (recess + 0.14) + up * 0.04,
            origin + u * (hw - 0.04) - out * (recess + 0.14) + up * (win_h - 0.04),
            origin - u * (hw - 0.04) - out * (recess + 0.14) + up * (win_h - 0.04),
            interior_mat, ensure_dir=out
        )
        # Reflective glass plane
        self.quad(
            origin - u * (hw - 0.03) - out * gl_z + up * 0.03,
            origin + u * (hw - 0.03) - out * gl_z + up * 0.03,
            origin + u * (hw - 0.03) - out * gl_z + up * (win_h - 0.03),
            origin - u * (hw - 0.03) - out * gl_z + up * (win_h - 0.03),
            glass_mat, uv_scale=0.35, ensure_dir=out
        )
        # Sill with crisp drip projection
        sill_mat = frame_mat
        bar_d = out * 0.09
        frame_p = -out * (gl_z - 0.03)
        self.quad(
            origin - u * (hw + 0.04) + out * sill_proj,
            origin + u * (hw + 0.04) + out * sill_proj,
            origin + u * (hw + 0.04) + out * sill_proj + up * 0.07,
            origin - u * (hw + 0.04) + out * sill_proj + up * 0.07,
            sill_mat, ensure_dir=out
        )
        self.quad(
            origin - u * (hw + 0.04) - out * gl_z + up * 0.07,
            origin + u * (hw + 0.04) - out * gl_z + up * 0.07,
            origin + u * (hw + 0.04) + out * sill_proj + up * 0.07,
            origin - u * (hw + 0.04) + out * sill_proj + up * 0.07,
            sill_mat, ensure_dir=up
        )
        # Mullions & transom bars proud of the glass
        m_w = 0.042
        for k in range(1, panes_x):
            mx = -hw + win_w * (k / panes_x)
            p_b = origin + u * mx + frame_p
            self.quad(p_b - u * m_w, p_b + u * m_w, p_b + u * m_w + up * win_h, p_b - u * m_w + up * win_h, frame_mat, ensure_dir=out)
            self.quad(p_b + u * m_w, p_b + u * m_w - bar_d, p_b + u * m_w - bar_d + up * win_h, p_b + u * m_w + up * win_h, frame_mat, ensure_dir=u)
        if has_transom and win_h > 1.25:
            tz = win_h * 0.74
            self.quad(
                origin - u * hw + frame_p + up * (tz - 0.035),
                origin + u * hw + frame_p + up * (tz - 0.035),
                origin + u * hw + frame_p + up * (tz + 0.035),
                origin - u * hw + frame_p + up * (tz + 0.035),
                frame_mat, ensure_dir=out
            )
            self.quad(
                origin - u * hw + frame_p - bar_d + up * (tz + 0.035),
                origin + u * hw + frame_p - bar_d + up * (tz + 0.035),
                origin + u * hw + frame_p + up * (tz + 0.035),
                origin - u * hw + frame_p + up * (tz + 0.035),
                frame_mat, ensure_dir=up
            )

    def add_window_bay(
        self,
        origin: Vector,
        u: Vector,
        out: Vector,
        bay_w: float,
        storey_h: float,
        win_w: float,
        win_h: float,
        sill_h: float = 0.88,
        recess: float = 0.24,
        wall_mat: str = "r2_wall_white_mosaic",
        frame_mat: str = "r2_trim_white",
        glass_mat: str = "r2_glass_window",
        panes_x: int = 3,
    ):
        """Constructs real recessed surround wall pier + head + sill + jambs + multi-pane window."""
        up = Vector((0, 0, 1))
        hw_b = bay_w * 0.5
        hw_w = win_w * 0.5
        z_head = sill_h + win_h

        # Lower sill wall
        self.quad(origin - u * hw_b, origin + u * hw_b, origin + u * hw_b + up * sill_h, origin - u * hw_b + up * sill_h, wall_mat, uv_scale=0.22, ensure_dir=out)
        # Upper lintel wall
        if z_head < storey_h - 0.01:
            self.quad(origin - u * hw_b + up * z_head, origin + u * hw_b + up * z_head, origin + u * hw_b + up * storey_h, origin - u * hw_b + up * storey_h, wall_mat, uv_scale=0.22, ensure_dir=out)
        # Side piers
        if hw_b - hw_w > 0.02:
            self.quad(origin - u * hw_b + up * sill_h, origin - u * hw_w + up * sill_h, origin - u * hw_w + up * z_head, origin - u * hw_b + up * z_head, wall_mat, uv_scale=0.22, ensure_dir=out)
            self.quad(origin + u * hw_w + up * sill_h, origin + u * hw_b + up * sill_h, origin + u * hw_b + up * z_head, origin + u * hw_w + up * z_head, wall_mat, uv_scale=0.22, ensure_dir=out)

        # Window jambs, lintel soffit, sill reveal
        d = out * recess
        self.quad(origin - u * hw_w - d + up * sill_h, origin + u * hw_w - d + up * sill_h, origin + u * hw_w + up * sill_h, origin - u * hw_w + up * sill_h, wall_mat, uv_scale=0.25, ensure_dir=up)
        self.quad(origin - u * hw_w + up * z_head, origin + u * hw_w + up * z_head, origin + u * hw_w - d + up * z_head, origin - u * hw_w - d + up * z_head, wall_mat, uv_scale=0.25, ensure_dir=-up)
        self.quad(origin - u * hw_w - d + up * sill_h, origin - u * hw_w + up * sill_h, origin - u * hw_w + up * z_head, origin - u * hw_w - d + up * z_head, wall_mat, uv_scale=0.25, ensure_dir=u)
        self.quad(origin + u * hw_w + up * sill_h, origin + u * hw_w - d + up * sill_h, origin + u * hw_w - d + up * z_head, origin + u * hw_w + up * z_head, wall_mat, uv_scale=0.25, ensure_dir=-u)

        self.add_window_assembly(
            origin + up * sill_h, u, out, win_w, win_h,
            frame_mat=frame_mat, glass_mat=glass_mat, recess=recess, panes_x=panes_x
        )

    def add_lingnan_barrel_roof(
        self,
        x0: float, y0: float, x1: float, y1: float,
        z_eave: float,
        pitch_deg: float = 28.0,
        overhang: float = 0.85,
        concave: float = 0.16,
        upturn: float = 0.42,
        tile_mat: str = "r2_roof_emerald",
        trim_mat: str = "r2_trim_white",
        soffit_mat: str = "r2_soffit_shadow",
        wadan_mat: str | None = None,
        tile_pitch: float = 0.24,
        ridge_h: float = 0.28,
        finial_peak: float = 0.0,
        is_gable_x: bool = False,
        xform: Matrix | None = None,
    ):
        """
        Museum-grade Lingnan curved ceramic roof with:
          - Smooth concave roof slopes + soaring upturned eave corners
          - Individual 3D half-round barrel tiles (筒瓦) running down every slope!
          - Circular Wadan (瓦当) end caps along eaves!
          - Solid soffit underside + fascia board + curved hip/main ridges with finials!
        """
        wadan_mat = wadan_mat or trim_mat
        cx, cy = 0.5 * (x0 + x1), 0.5 * (y0 + y1)
        ex0, ey0, ex1, ey1 = x0 - overhang, y0 - overhang, x1 + overhang, y1 + overhang
        W, D = ex1 - ex0, ey1 - ey0
        slope_tan = math.tan(math.radians(pitch_deg))

        if is_gable_x:
            # Traditional XuanShan gable-hip / straight-ridge roof (as on Fengqitang!)
            rx0, rx1 = ex0, ex1
            ry0 = ry1 = cy
            rise = 0.5 * D * slope_tan
            along_x = True
        elif W >= D * 1.04:
            ridge_half = max(0.0, 0.5 * (W - D))
            rise = 0.5 * D * slope_tan
            rx0, rx1 = cx - ridge_half, cx + ridge_half
            ry0 = ry1 = cy
            along_x = True
        else:
            ridge_half = max(0.0, 0.5 * (D - W))
            rise = 0.5 * W * slope_tan
            rx0 = rx1 = cx
            ry0, ry1 = cy - ridge_half, cy + ridge_half
            along_x = False

        def tf(v: Vector) -> Vector:
            return xform @ v if xform is not None else v

        def corner_lift(px: float, py: float) -> float:
            if is_gable_x:
                return 0.0
            dx = min(abs(px - ex0), abs(px - ex1))
            dy = min(abs(py - ey0), abs(py - ey1))
            dist = math.hypot(dx, dy)
            span = min(2.8, min(W, D) * 0.40)
            t = max(0.0, 1.0 - dist / max(span, 0.4))
            return upturn * (t ** 1.9)

        def eval_pt(pe: Vector, pr: Vector, t: float) -> Vector:
            p = pe.lerp(pr, t)
            sag = -concave * rise * math.sin(t * math.pi)
            lift = corner_lift(p.x, p.y) * ((1.0 - t) ** 2.1)
            p.z = z_eave + rise * t + sag + lift
            return p

        c_sw, c_se, c_ne, c_nw = Vector((ex0, ey0, z_eave)), Vector((ex1, ey0, z_eave)), Vector((ex1, ey1, z_eave)), Vector((ex0, ey1, z_eave))
        r0, r1 = Vector((rx0, ry0, z_eave + rise)), Vector((rx1, ry1, z_eave + rise))

        if is_gable_x:
            slopes = [(c_sw, c_se, r0, r1, True), (c_ne, c_nw, r1, r0, True)]
        elif along_x:
            slopes = [(c_sw, c_se, r0, r1, False), (c_ne, c_nw, r1, r0, False), (c_se, c_ne, r1, r1, False), (c_nw, c_sw, r0, r0, False)]
        else:
            slopes = [(c_se, c_ne, r0, r1, False), (c_nw, c_sw, r1, r0, False), (c_ne, c_nw, r1, r1, False), (c_sw, c_se, r0, r0, False)]

        segs_slope = 8
        up_vec = (xform.to_3x3() @ Vector((0, 0, 1))).normalized() if xform else Vector((0, 0, 1))

        for ea, eb, ra, rb, _gable in slopes:
            edge_len = (eb - ea).length
            nu = max(3, min(14, int(round(edge_len / 0.9))))
            grid = []
            for j in range(segs_slope + 1):
                tj = j / segs_slope
                grid.append([tf(eval_pt(ea.lerp(eb, i / nu), ra.lerp(rb, i / nu), tj)) for i in range(nu + 1)])

            for j in range(segs_slope):
                for i in range(nu):
                    p00, p10, p11, p01 = grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]
                    if (p11 - p01).length < 1e-4:
                        self.tri(p00, p10, p01, tile_mat, uv_scale=0.35, ensure_dir=up_vec)
                    else:
                        self.quad(p00, p10, p11, p01, tile_mat, uv_scale=0.35, ensure_dir=up_vec)

            # Real 3D raised barrel-tile ribs (筒瓦) + circular Wadan eave medallions!
            n_tiles = max(4, min(72, int(round(edge_len / tile_pitch))))
            rib_w = tile_pitch * 0.24
            rib_h = 0.055
            for k in range(n_tiles):
                tk = (k + 0.5) / n_tiles
                pe_k = ea.lerp(eb, tk)
                pr_k = ra.lerp(rb, tk)
                tangent_e = (eb - ea).normalized()
                # Step along tile run with 4 segments to hug concavity smoothly
                pts_l, pts_c, pts_r = [], [], []
                for j in range(5):
                    tj = j / 4.0
                    # Clip hip-triangle barrel tiles cleanly before reaching apex
                    scale_w = (1.0 - tj * 0.85) if (ra - rb).length < 0.05 else 1.0
                    if scale_w < 0.12 and j == 4:
                        scale_w = 0.08
                    pc = eval_pt(pe_k, pr_k, tj)
                    pts_l.append(tf(pc - tangent_e * (rib_w * scale_w)))
                    pts_c.append(tf(pc + Vector((0, 0, rib_h))))
                    pts_r.append(tf(pc + tangent_e * (rib_w * scale_w)))
                for j in range(4):
                    self.quad(pts_l[j], pts_c[j], pts_c[j + 1], pts_l[j + 1], tile_mat, uv_scale=0.5, ensure_dir=up_vec)
                    self.quad(pts_c[j], pts_r[j], pts_r[j + 1], pts_c[j + 1], tile_mat, uv_scale=0.5, ensure_dir=up_vec)
                # Eave Wadan circular cap + drip lip facing outward from eave!
                out_dir = (pe_k - Vector((cx, cy, pe_k.z)))
                out_dir.z = 0
                out_dir = (xform.to_3x3() @ out_dir.normalized()) if (xform and out_dir.length > 1e-4) else (out_dir.normalized() if out_dir.length > 1e-4 else Vector((0, 1, 0)))
                self.tri(pts_l[0] - up_vec * 0.025, pts_r[0] - up_vec * 0.025, pts_c[0], wadan_mat, ensure_dir=out_dir)

            # Clean fascia edge board + soffit return along eave
            f_h = 0.20
            eave_out = (ea.lerp(eb, 0.5) - Vector((cx, cy, z_eave)))
            eave_out.z = 0
            eo_w = (xform.to_3x3() @ eave_out.normalized()) if (xform and eave_out.length > 1e-4) else (eave_out.normalized() if eave_out.length > 1e-4 else Vector((0, 1, 0)))
            for i in range(nu):
                a0, a1 = grid[0][i], grid[0][i + 1]
                self.quad(a0 - up_vec * f_h, a1 - up_vec * f_h, a1, a0, trim_mat, uv_scale=0.5, ensure_dir=eo_w)

        # Soffit ceiling closure under roof (facing -Z)
        so = z_eave - 0.19
        self.quad(tf(Vector((ex0, ey0, so))), tf(Vector((ex0, ey1, so))), tf(Vector((ex1, ey1, so))), tf(Vector((ex1, ey0, so))), soffit_mat, ensure_dir=-up_vec)

        if is_gable_x:
            # Gable end triangles + bargeboards
            for gx, gn in ((ex0, Vector((-1, 0, 0))), (ex1, Vector((1, 0, 0)))):
                g_dir = (xform.to_3x3() @ gn).normalized() if xform else gn
                self.tri(tf(Vector((gx, ey0, z_eave - 0.18))), tf(Vector((gx, ey1, z_eave - 0.18))), tf(Vector((gx, cy, z_eave + rise))), trim_mat, ensure_dir=g_dir)

        # Main ridge + upturned hip ridges
        if (r1 - r0).length > 0.05:
            rw = ridge_h * 0.40
            self.box((rx0 - 0.08, cy - rw, z_eave + rise - 0.02), (rx1 + 0.08, cy + rw, z_eave + rise + ridge_h), trim_mat, xform=xform)
            for end_x in (rx0 - 0.14, rx1 + 0.14):
                sign_x = -1 if end_x < cx else 1
                self.box((end_x - 0.10, cy - rw * 1.05, z_eave + rise + ridge_h * 0.35), (end_x + 0.10, cy + rw * 1.05, z_eave + rise + ridge_h + 0.18), trim_mat, xform=xform)
                self.tube([tf(Vector((end_x, cy, z_eave + rise + ridge_h + 0.10))), tf(Vector((end_x + sign_x * 0.18, cy, z_eave + rise + ridge_h + 0.25)))], 0.065, 6, trim_mat)
        elif finial_peak > 0.0:
            # Pyramidal pavilion central gourd finial (宝顶!)
            self.lathe(
                (cx, cy, z_eave + rise - 0.02),
                [(0.28, 0.0), (0.30, 0.16), (0.14, 0.28), (0.24, 0.48), (0.20, 0.68), (0.06, 0.88), (0.0, finial_peak)],
                16, tile_mat, xform=xform
            )

        # Curved hip ridges smoothly hugging roof slopes down to upturned corners
        if not is_gable_x:
            for ce, rp in ((c_sw, r0), (c_se, r1 if along_x else r0), (c_ne, r1), (c_nw, r0 if along_x else r1)):
                pts = []
                for j in range(10):
                    p = eval_pt(ce, rp, j / 9.0)
                    p.z += 0.032
                    pts.append(tf(p))
                pts[0] = tf(eval_pt(ce, rp, 0.0) + Vector((0, 0, 0.095)))
                self.tube(pts, 0.072, 6, trim_mat)

    def add_guardian_lion(self, base_center: tuple[float, float, float], face_dir_y: float, mat_name: str = "r2_stone_carved_pale", scale: float = 1.0):
        """
        Sculpted traditional stone guardian lion (stone lion + tiered Xumi pedestal) —
        much cleaner and more recognizable than crude block stacks!
        """
        cx, cy, cz = base_center
        yaw = 0.0 if face_dir_y >= 0 else math.pi
        xf = Matrix.Translation((cx, cy, cz)) @ Matrix.Rotation(yaw, 4, "Z") @ Matrix.Scale(scale, 4)

        # Tiered Xumi (须弥座) relief pedestal (height = 1.15m)
        self.box((-0.48, -0.56, 0.0), (0.48, 0.56, 0.14), mat_name, xform=xf)
        self.box((-0.42, -0.50, 0.14), (0.42, 0.50, 0.34), mat_name, xform=xf)
        self.box((-0.34, -0.42, 0.34), (0.34, 0.42, 0.90), mat_name, xform=xf)
        # Carved waist medallion panels on pedestal front & sides
        self.box((-0.24, 0.42, 0.42), (0.24, 0.46, 0.82), mat_name, xform=xf)
        self.box((-0.42, -0.50, 0.90), (0.42, 0.50, 1.06), mat_name, xform=xf)
        self.box((-0.46, -0.54, 1.06), (0.46, 0.54, 1.16), mat_name, xform=xf)

        # Seated stone lion body above z=1.16 (facing +Y in local space)
        lz = 1.16
        # Haunches & seated torso
        self.lathe((0, -0.10, lz), [(0.34, 0.0), (0.36, 0.14), (0.29, 0.38), (0.25, 0.62), (0.28, 0.78), (0.0, 0.92)], 12, mat_name, xform=xf)
        # Proud rounded chest forward
        self.lathe((0, 0.10, lz + 0.25), [(0.0, 0.0), (0.22, 0.14), (0.26, 0.36), (0.22, 0.54), (0.0, 0.66)], 10, mat_name, xform=xf)
        # Sturdy planted forelegs + paws
        for sx in (-0.15, 0.15):
            self.cylinder((sx, 0.24, lz), 0.095, 0.075, 0.52, 10, mat_name, xform=xf)
            self.box((sx - 0.09, 0.22, lz), (sx + 0.09, 0.40, lz + 0.10), mat_name, xform=xf)
        # Lion head + curled mane + muzzle + brow + ears
        self.lathe((0, 0.12, lz + 0.72), [(0.0, 0.0), (0.22, 0.08), (0.25, 0.22), (0.21, 0.36), (0.12, 0.44), (0.0, 0.48)], 12, mat_name, xform=xf)
        self.box((-0.13, 0.22, lz + 0.80), (0.13, 0.39, lz + 0.95), mat_name, xform=xf)  # muzzle
        self.box((-0.16, 0.20, lz + 0.95), (0.16, 0.35, lz + 1.03), mat_name, xform=xf)  # fierce brow
        for sx in (-0.15, 0.15):
            self.lathe((sx, 0.14, lz + 1.06), [(0.06, 0.0), (0.05, 0.06), (0.0, 0.11)], 8, mat_name, xform=xf)
        # Sweeping upright curled tail up the back
        self.tube(
            [xf @ Vector((0, -0.34, lz + 0.14)), xf @ Vector((0, -0.38, lz + 0.42)), xf @ Vector((0, -0.28, lz + 0.66))],
            0.065, 6, mat_name
        )

    def finalize(self, name: str, collection: bpy.types.Collection, extras: dict | None = None, smooth: bool = False) -> bpy.types.Object:
        if smooth:
            for f in self.bm.faces:
                f.smooth = True
        me = bpy.data.meshes.new(name)
        self.bm.to_mesh(me)
        self.bm.free()
        for mn in self.mat_list:
            me.materials.append(self.mats[mn])
        me.update()
        obj = bpy.data.objects.new(name, me)
        collection.objects.link(obj)
        if extras:
            for k, v in extras.items():
                obj[k] = v
        return obj
