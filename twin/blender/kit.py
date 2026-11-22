"""Geometry kit for the HAIZ twin (runs inside Blender's Python, bpy 5.x).

Everything is built in the *twin* frame (metres, +x campus east, +y campus north, +z up).
Geometry is accumulated per material in plain Python lists and turned into one Blender mesh
per object at the end (fast, deterministic, no operators or booleans).

UVs are world-space metric box projections (1 UV unit = 1 m) so that any tiling texture in a
later art pass keeps real-world scale.  Each face gets the projection of its dominant normal axis.
"""
from __future__ import annotations
import math
import bpy
from mathutils import Vector, Matrix

V = Vector


def v3(p):
    return p if isinstance(p, Vector) else Vector((p[0], p[1], p[2] if len(p) > 2 else 0.0))


class Geo:
    """Multi-material polygon soup with metric UVs."""

    def __init__(self):
        self.verts: list[Vector] = []
        self.faces: list[tuple[int, ...]] = []
        self.fmat: list[str] = []
        self.fuv: list[list[tuple[float, float]]] = []

    # -- primitives ------------------------------------------------------------------
    def poly(self, mat: str, pts, uv=None):
        pts = [v3(p) for p in pts]
        if len(pts) < 3:
            return
        n = (pts[1] - pts[0]).cross(pts[2] - pts[0])
        if n.length < 1e-12:
            # find a better triple
            for i in range(len(pts)):
                n = (pts[(i + 1) % len(pts)] - pts[i]).cross(pts[(i + 2) % len(pts)] - pts[i])
                if n.length > 1e-12:
                    break
        base = len(self.verts)
        self.verts.extend(pts)
        self.faces.append(tuple(range(base, base + len(pts))))
        self.fmat.append(mat)
        if uv is None:
            uv = box_uv(pts, n)
        self.fuv.append(uv)

    def quad(self, mat, a, b, c, d, uv=None):
        self.poly(mat, [a, b, c, d], uv)

    def tri(self, mat, a, b, c):
        self.poly(mat, [a, b, c])

    def polyn(self, mat, pts, normal):
        """Polygon whose winding is fixed so that its normal points along `normal`."""
        P = [v3(p) for p in pts]
        n = Vector((0.0, 0.0, 0.0))
        for i in range(len(P)):
            a, b = P[i], P[(i + 1) % len(P)]
            n += Vector(((a.y - b.y) * (a.z + b.z), (a.z - b.z) * (a.x + b.x), (a.x - b.x) * (a.y + b.y)))
        if n.dot(v3(normal)) < 0:
            P = list(reversed(P))
        self.poly(mat, P)

    def box(self, mat, mn, mx, skip=()):
        """Axis-aligned box.  skip: subset of {'-x','+x','-y','+y','-z','+z'} faces to omit."""
        x0, y0, z0 = mn
        x1, y1, z1 = mx
        if x1 < x0: x0, x1 = x1, x0
        if y1 < y0: y0, y1 = y1, y0
        if z1 < z0: z0, z1 = z1, z0
        P = [V((x0, y0, z0)), V((x1, y0, z0)), V((x1, y1, z0)), V((x0, y1, z0)),
             V((x0, y0, z1)), V((x1, y0, z1)), V((x1, y1, z1)), V((x0, y1, z1))]
        F = {'-z': (0, 3, 2, 1), '+z': (4, 5, 6, 7), '-y': (0, 1, 5, 4), '+y': (2, 3, 7, 6),
             '-x': (3, 0, 4, 7), '+x': (1, 2, 6, 5)}
        for k, f in F.items():
            if k in skip:
                continue
            self.poly(mat, [P[i] for i in f])

    def obox(self, mat, center, axes, half, skip=()):
        """Oriented box: center, axes=(ux,uy,uz) unit vectors, half extents (hx,hy,hz)."""
        c = v3(center)
        ux, uy, uz = (v3(a) for a in axes)
        hx, hy, hz = half
        def P(sx, sy, sz):
            return c + ux * (sx * hx) + uy * (sy * hy) + uz * (sz * hz)
        F = {'-z': [(-1, -1, -1), (-1, 1, -1), (1, 1, -1), (1, -1, -1)],
             '+z': [(-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)],
             '-y': [(-1, -1, -1), (1, -1, -1), (1, -1, 1), (-1, -1, 1)],
             '+y': [(1, 1, -1), (-1, 1, -1), (-1, 1, 1), (1, 1, 1)],
             '-x': [(-1, 1, -1), (-1, -1, -1), (-1, -1, 1), (-1, 1, 1)],
             '+x': [(1, -1, -1), (1, 1, -1), (1, 1, 1), (1, -1, 1)]}
        for k, f in F.items():
            if k in skip:
                continue
            self.poly(mat, [P(*s) for s in f])

    def prism(self, mat, poly2d, z0, z1, top=True, bottom=False, side_mat=None):
        """Vertical prism over a CCW 2D polygon."""
        n = len(poly2d)
        sm = side_mat or mat
        for i in range(n):
            a = poly2d[i]; b = poly2d[(i + 1) % n]
            self.quad(sm, (a[0], a[1], z0), (b[0], b[1], z0), (b[0], b[1], z1), (a[0], a[1], z1))
        if top:
            self.poly(mat, [(p[0], p[1], z1) for p in poly2d])
        if bottom:
            self.poly(mat, [(p[0], p[1], z0) for p in reversed(poly2d)])

    def cylinder(self, mat, c, r, z0, z1, seg=16, top=True, bottom=False, r1=None):
        r1 = r if r1 is None else r1
        ring0 = [(c[0] + r * math.cos(2 * math.pi * i / seg), c[1] + r * math.sin(2 * math.pi * i / seg)) for i in range(seg)]
        ring1 = [(c[0] + r1 * math.cos(2 * math.pi * i / seg), c[1] + r1 * math.sin(2 * math.pi * i / seg)) for i in range(seg)]
        for i in range(seg):
            j = (i + 1) % seg
            self.quad(mat, (*ring0[i], z0), (*ring0[j], z0), (*ring1[j], z1), (*ring1[i], z1))
        if top:
            self.poly(mat, [(*p, z1) for p in ring1])
        if bottom:
            self.poly(mat, [(*p, z0) for p in reversed(ring0)])

    def sweep(self, mat, profile, path, closed=False, caps=True, up=(0, 0, 1)):
        """Sweep a 2D profile along a polyline with mitred joints.

        profile: list of (s, t): s along the path's left-hand horizontal normal (outward if the
        path runs CCW around a footprint... we use right-hand: s>0 is to the RIGHT of the
        direction of travel), t along `up`.  The profile is treated as an open polyline unless
        its first and last points coincide.
        """
        up = v3(up)
        P = [v3(p) for p in path]
        n = len(P)
        if n < 2:
            return
        def seg_dir(i):
            return (P[(i + 1) % n] - P[i]).normalized()
        rings = []
        for i in range(n):
            if not closed and i == 0:
                d = seg_dir(0); r = d.cross(up).normalized(); scale = 1.0
            elif not closed and i == n - 1:
                d = (P[-1] - P[-2]).normalized(); r = d.cross(up).normalized(); scale = 1.0
            else:
                d0 = (P[i] - P[i - 1]).normalized(); d1 = (P[(i + 1) % n] - P[i]).normalized()
                r0 = d0.cross(up).normalized(); r1 = d1.cross(up).normalized()
                r = (r0 + r1)
                if r.length < 1e-6:
                    r = r0
                r.normalize()
                cosang = max(0.2, r.dot(r0))
                scale = 1.0 / cosang
            rings.append([P[i] + r * (s * scale) + up * t for s, t in profile])
        m = len(profile)
        segs = n if closed else n - 1
        for i in range(segs):
            A = rings[i]; B = rings[(i + 1) % n]
            for j in range(m - 1):
                self.quad(mat, A[j], B[j], B[j + 1], A[j + 1])
        if caps and not closed and m >= 3:
            self.poly(mat, list(reversed(rings[0])))
            self.poly(mat, rings[-1])

    def add_indexed(self, mat, verts, faces, uv_scale: float = 1.0):
        """Shared-vertex mesh (e.g. marching cubes, tubes, leaf batches).  verts: (N, 3) array-like,
        faces: sequence of index tuples into verts; mat: one name or a per-face sequence."""
        import numpy as np
        V3 = np.asarray(verts, dtype=float)
        base = len(self.verts)
        self.verts.extend(Vector(v) for v in V3)
        F = [tuple(int(i) for i in f) for f in faces]
        self.faces.extend(tuple(base + i for i in f) for f in F)
        if isinstance(mat, str):
            self.fmat.extend([mat] * len(F))
        else:
            self.fmat.extend(mat)
        # planar box UVs per face from the dominant axis of the face normal
        for f in F:
            P = V3[list(f)]
            n = np.cross(P[1] - P[0], P[2] - P[0])
            ax = int(np.argmax(np.abs(n)))
            if ax == 2:
                uv = P[:, [0, 1]]
            elif ax == 0:
                uv = P[:, [1, 2]]
            else:
                uv = P[:, [0, 2]]
            self.fuv.append([tuple(c * uv_scale) for c in uv])

    # -- composition -----------------------------------------------------------------
    def merge(self, other: 'Geo', M: Matrix | None = None):
        base = len(self.verts)
        if M is None:
            self.verts.extend(v.copy() for v in other.verts)
        else:
            self.verts.extend(M @ v for v in other.verts)
        self.faces.extend(tuple(i + base for i in f) for f in other.faces)
        self.fmat.extend(other.fmat)
        self.fuv.extend(other.fuv if M is None else [box_uv([M @ other.verts[i] for i in f], None) for f in other.faces])

    def transformed(self, M: Matrix) -> 'Geo':
        g = Geo(); g.merge(self, M); return g

    @property
    def nfaces(self):
        return len(self.faces)

    # -- output ----------------------------------------------------------------------
    def to_mesh(self, name: str, materials: dict | None = None, smooth_angle: float | None = None):
        me = bpy.data.meshes.new(name)
        me.from_pydata([tuple(v) for v in self.verts], [], self.faces)
        names = []
        for m in self.fmat:
            if m not in names:
                names.append(m)
        for nm in names:
            me.materials.append(get_material(nm, materials))
        idx = {nm: i for i, nm in enumerate(names)}
        me.polygons.foreach_set('material_index', [idx[m] for m in self.fmat])
        uvl = me.uv_layers.new(name='UVMap')
        flat = []
        for f, uv in zip(self.faces, self.fuv):
            flat.extend(uv)
        # loops are in face order for from_pydata
        uvl.data.foreach_set('uv', [c for p in flat for c in p])
        me.validate(clean_customdata=False)
        me.update()
        if smooth_angle is not None:
            me.shade_smooth()
            try:
                me.set_sharp_from_angle(angle=math.radians(smooth_angle))
            except Exception:
                pass
        return me

    def to_object(self, name: str, collection=None, materials=None, smooth_angle=None):
        me = self.to_mesh(name, materials, smooth_angle)
        ob = bpy.data.objects.new(name, me)
        (collection or bpy.context.scene.collection).objects.link(ob)
        return ob


def box_uv(pts, n):
    if n is None:
        n = (pts[1] - pts[0]).cross(pts[2] - pts[0]) if len(pts) >= 3 else V((0, 0, 1))
    ax = max(range(3), key=lambda i: abs(n[i]))
    if ax == 2:
        return [(p.x, p.y) for p in pts]
    if ax == 0:
        return [(p.y, p.z) for p in pts]
    return [(p.x, p.z) for p in pts]


# ---------------------------------------------------------------------------------------
# Materials.  Names are semantic ("what it is"), never stylistic, so that an art pass can
# re-skin the same geometry.  Values are physically plausible reference PBR factors read
# off the reference photographs by eye (estimated, not measured).
# ---------------------------------------------------------------------------------------
MATERIALS = {
    # name: (base color sRGB, roughness, metallic, extra)
    'wall.render.white':     ((0.86, 0.86, 0.84), 0.85, 0.0, {}),
    'wall.render.grey':      ((0.74, 0.75, 0.75), 0.85, 0.0, {}),
    'wall.render.cream':     ((0.88, 0.84, 0.74), 0.85, 0.0, {}),
    'wall.render.pink':      ((0.86, 0.74, 0.72), 0.85, 0.0, {}),
    'wall.tile.white':       ((0.88, 0.88, 0.86), 0.45, 0.0, {}),
    'trim.white':            ((0.92, 0.92, 0.90), 0.6, 0.0, {}),
    'stone.granite.dark':    ((0.25, 0.26, 0.25), 0.38, 0.0, {}),
    'stone.granite.grey':    ((0.52, 0.52, 0.50), 0.5, 0.0, {}),
    'stone.granite.red':     ((0.55, 0.27, 0.22), 0.45, 0.0, {}),
    'stone.granite.white':   ((0.80, 0.79, 0.76), 0.4, 0.0, {}),
    'stone.limestone.taihu': ((0.42, 0.42, 0.40), 0.8, 0.0, {}),
    'stone.rock.boulder':    ((0.38, 0.34, 0.29), 0.85, 0.0, {}),
    'roof.tile.red':         ((0.78, 0.20, 0.13), 0.55, 0.0, {}),
    'roof.tile.green':       ((0.11, 0.30, 0.22), 0.35, 0.0, {}),
    'roof.flat.white':       ((0.80, 0.80, 0.78), 0.8, 0.0, {}),
    'roof.flat.grey':        ((0.45, 0.46, 0.45), 0.9, 0.0, {}),
    'glass.window':          ((0.20, 0.32, 0.42), 0.05, 0.0, {'transmission': 0.0, 'alpha': 1.0, 'specular': 0.9}),
    'frame.alu.white':       ((0.90, 0.91, 0.91), 0.35, 0.3, {}),
    'frame.alu.grey':        ((0.45, 0.47, 0.48), 0.35, 0.6, {}),
    'frame.alu.brown':       ((0.33, 0.20, 0.15), 0.4, 0.3, {}),
    'interior.dark':         ((0.10, 0.10, 0.10), 0.9, 0.0, {}),
    'interior.curtain':      ((0.86, 0.82, 0.72), 0.9, 0.0, {}),
    'interior.ceiling':      ((0.80, 0.80, 0.78), 0.9, 0.0, {}),
    'interior.floor':        ((0.45, 0.43, 0.40), 0.6, 0.0, {}),
    'sign.metal.bronze':     ((0.45, 0.35, 0.22), 0.35, 0.9, {}),
    'metal.steel.dark':      ((0.18, 0.19, 0.20), 0.45, 0.8, {}),
    'metal.steel.white':     ((0.88, 0.88, 0.86), 0.4, 0.5, {}),
    'paint.red.column':      ((0.62, 0.12, 0.09), 0.5, 0.0, {}),
    'paint.gold':            ((0.80, 0.60, 0.25), 0.35, 0.8, {}),
    'paint.green.fret':      ((0.13, 0.42, 0.33), 0.5, 0.0, {}),
    'paint.ochre.fret':      ((0.78, 0.50, 0.22), 0.5, 0.0, {}),
    'paving.granite.light':  ((0.72, 0.70, 0.66), 0.7, 0.0, {}),
    'paving.granite.grey':   ((0.55, 0.55, 0.53), 0.75, 0.0, {}),
    'paving.granite.dark':   ((0.35, 0.36, 0.36), 0.75, 0.0, {}),
    'paving.brick.red':      ((0.55, 0.28, 0.22), 0.85, 0.0, {}),
    'paving.asphalt':        ((0.20, 0.20, 0.20), 0.92, 0.0, {}),
    'paving.concrete':       ((0.62, 0.61, 0.58), 0.9, 0.0, {}),
    'kerb.granite':          ((0.62, 0.62, 0.60), 0.7, 0.0, {}),
    'ground.lawn':           ((0.24, 0.34, 0.13), 0.95, 0.0, {}),
    'ground.context':        ((0.33, 0.36, 0.26), 0.95, 0.0, {}),
    'ground.soil':           ((0.36, 0.27, 0.18), 0.95, 0.0, {}),
    'ground.mulch':          ((0.28, 0.22, 0.15), 0.95, 0.0, {}),
    'water.pond':            ((0.12, 0.20, 0.16), 0.03, 0.0, {}),
    'plant.hedge':           ((0.12, 0.30, 0.08), 0.8, 0.0, {}),
    'plant.groundcover':     ((0.09, 0.21, 0.05), 0.85, 0.0, {}),
    'bark.terminalia':       ((0.17, 0.13, 0.095), 0.9, 0.0, {}),
    'leaf.terminalia':       ((0.17, 0.33, 0.09), 0.6, 0.0, {'subsurface': 0.1}),
    'bark.palm':             ((0.60, 0.59, 0.55), 0.8, 0.0, {}),
    'paint.white.trunk':     ((0.88, 0.88, 0.85), 0.8, 0.0, {}),
    'palm.crownshaft':       ((0.36, 0.50, 0.20), 0.45, 0.0, {}),
    'leaf.palm':             ((0.22, 0.36, 0.13), 0.6, 0.0, {}),
    'bark.araucaria':        ((0.36, 0.30, 0.25), 0.9, 0.0, {}),
    'bark.coconut':          ((0.48, 0.44, 0.38), 0.9, 0.0, {}),
    'leaf.coconut':          ((0.30, 0.40, 0.14), 0.6, 0.0, {}),
    'palm.coconut.nut':      ((0.45, 0.42, 0.15), 0.6, 0.0, {}),
    'paint.red.inscription': ((0.70, 0.08, 0.06), 0.5, 0.0, {}),
    'stone.rock.yellow':     ((0.55, 0.48, 0.38), 0.85, 0.0, {}),
    'leaf.araucaria':        ((0.12, 0.26, 0.10), 0.7, 0.0, {}),
    'leaf.terminalia.old':   ((0.55, 0.30, 0.10), 0.6, 0.0, {}),
    'leaf.terminalia.young': ((0.30, 0.45, 0.12), 0.55, 0.0, {}),
    'bark.generic':          ((0.33, 0.28, 0.22), 0.9, 0.0, {}),
    'leaf.generic':          ((0.15, 0.30, 0.09), 0.6, 0.0, {}),
    'track.rubber.red':      ((0.55, 0.20, 0.14), 0.9, 0.0, {}),
    'court.acrylic.blue':    ((0.25, 0.32, 0.55), 0.7, 0.0, {}),
    'line.paint.white':      ((0.92, 0.92, 0.90), 0.7, 0.0, {}),
    'unknown.massing':       ((0.80, 0.78, 0.74), 0.9, 0.0, {}),
}


def srgb_to_lin(c):
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def get_material(name: str, overrides: dict | None = None):
    mat = bpy.data.materials.get(name)
    if mat is not None:
        return mat
    spec = (overrides or {}).get(name) or MATERIALS.get(name) or MATERIALS['unknown.massing']
    col, rough, metal, extra = spec
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    lin = srgb_to_lin(col)
    bsdf.inputs['Base Color'].default_value = (*lin, 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if 'specular' in extra and 'Specular IOR Level' in bsdf.inputs:
        bsdf.inputs['Specular IOR Level'].default_value = extra['specular']
    if 'subsurface' in extra and 'Subsurface Weight' in bsdf.inputs:
        bsdf.inputs['Subsurface Weight'].default_value = extra['subsurface']
    mat.diffuse_color = (*lin, 1.0)
    mat['haiz_semantic'] = name
    return mat


# ---------------------------------------------------------------------------------------
# small vector helpers for 2D wall work
# ---------------------------------------------------------------------------------------
def along(p0, p1, s, z=0.0, out=0.0):
    """Point at distance s from p0 towards p1 (2D), offset `out` along the right-hand normal."""
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    L = math.hypot(dx, dy)
    ux, uy = dx / L, dy / L
    nx, ny = uy, -ux      # right-hand normal
    return V((p0[0] + ux * s + nx * out, p0[1] + uy * s + ny * out, z))


def seg_frame(p0, p1, z=0.0):
    """Right-handed facade frame for a wall from p0 to p1 (2D).

    Local X runs p0 -> p1 (left -> right when seen from outside a CCW footprint), local Y points
    INTO the building (left-hand normal), Z is up.  The exterior face lies on Y = 0 and anything
    that sticks out of the wall has Y < 0.  Returns (matrix local->twin, wall length).
    """
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    L = math.hypot(dx, dy)
    ux, uy = dx / L, dy / L
    M = Matrix(((ux, -uy, 0.0, p0[0]), (uy, ux, 0.0, p0[1]), (0.0, 0.0, 1.0, z), (0.0, 0.0, 0.0, 1.0)))
    return M, L


# ---------------------------------------------------------------------------------------
# ground helpers (shapely polygons in the twin XY plane)
# ---------------------------------------------------------------------------------------

def iter_polys(geom):
    if geom is None or geom.is_empty:
        return
    if geom.geom_type == 'Polygon':
        yield geom
    elif hasattr(geom, 'geoms'):
        for g in geom.geoms:
            yield from iter_polys(g)


def area(g: Geo, mat: str, geom, z: float):
    """Flat, upward-facing surface over a shapely (Multi)Polygon with holes (constrained Delaunay)."""
    import shapely
    for poly in iter_polys(geom):
        if poly.area < 1e-4:
            continue
        tris = shapely.constrained_delaunay_triangles(poly)
        for t in tris.geoms:
            c = list(t.exterior.coords)[:3]
            g.polyn(mat, [(x, y, z) for x, y in c], (0, 0, 1))


def drops(g: Geo, mat: str, geom, z: float, level_at, step: float = 1.0):
    """Vertical faces around a raised (Multi)Polygon at height z down to whatever level lies
    outside each edge (level_at(x, y) -> z).  Outward-facing; segments of <= step metres."""
    for poly in iter_polys(geom):
        rings = [poly.exterior] + list(poly.interiors)
        for k, ring in enumerate(rings):
            pts = list(ring.coords)
            # exterior CCW -> outward normal is the right-hand normal; holes CW -> same rule
            ccw = ring.is_ccw
            for a, b in zip(pts[:-1], pts[1:]):
                dx, dy = b[0] - a[0], b[1] - a[1]
                L = math.hypot(dx, dy)
                if L < 1e-6:
                    continue
                nx, ny = (dy / L, -dx / L)
                if (k == 0 and not ccw) or (k > 0 and ccw):
                    nx, ny = -nx, -ny
                n = max(1, int(math.ceil(L / step)))
                for i in range(n):
                    p = (a[0] + dx * i / n, a[1] + dy * i / n)
                    q = (a[0] + dx * (i + 1) / n, a[1] + dy * (i + 1) / n)
                    m = ((p[0] + q[0]) / 2 + nx * 0.05, (p[1] + q[1]) / 2 + ny * 0.05)
                    zo = level_at(*m)
                    if zo < z - 1e-3:
                        g.polyn(mat, [(p[0], p[1], zo), (q[0], q[1], zo), (q[0], q[1], z), (p[0], p[1], z)], (nx, ny, 0))
