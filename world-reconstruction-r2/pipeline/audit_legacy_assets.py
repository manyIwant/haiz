"""
HAIZ · World Reconstruction Round 2 — Existing Asset Audit Script (Read-Only)
Inspects all 9 twin/assets/atelier/*.glb master files + twin/assets/phase1/{gate,campus}.glb
in Blender 5.2.3 LTS, recording exact world bounding boxes (twin ENU metric frame),
triangle counts, COLOR_0 vertex color layers, embedded texture sizes, and alpha modes.
"""
import json
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path("/Users/a11/manyiwant/haiz-world-reconstruction-r2")
OUT = ROOT / "world-reconstruction-r2/data/legacy_audit.json"

TARGETS = [
    ("atelier_yihao", ROOT / "twin/assets/atelier/yihao.glb"),
    ("atelier_landmark", ROOT / "twin/assets/atelier/landmark.glb"),
    ("atelier_terminalia", ROOT / "twin/assets/atelier/terminalia.glb"),
    ("atelier_forecourt", ROOT / "twin/assets/atelier/forecourt.glb"),
    ("atelier_erhao", ROOT / "twin/assets/atelier/erhao.glb"),
    ("atelier_science", ROOT / "twin/assets/atelier/science.glb"),
    ("atelier_south_classrooms", ROOT / "twin/assets/atelier/south_classrooms.glb"),
    ("atelier_yanchi", ROOT / "twin/assets/atelier/yanchi.glb"),
    ("atelier_arts", ROOT / "twin/assets/atelier/arts.glb"),
    ("phase1_gate", ROOT / "twin/assets/phase1/gate.glb"),
    ("phase1_campus", ROOT / "twin/assets/phase1/campus.glb"),
]

results = {}

for key, path in TARGETS:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))

    # Blender's glTF importer converts glTF Y-up (+X, +Y, +Z) -> Blender Z-up (+X, -Z, +Y),
    # which directly maps glTF (tx, ty, tz) = (sx, sz, -sy) BACK into Spec/Twin (sx, sy, sz)!
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    total_verts = 0
    total_tris = 0
    bmin = [1e9, 1e9, 1e9]
    bmax = [-1e9, -1e9, -1e9]
    vcol_layers = set()
    mat_names = []
    alpha_modes = set()

    for o in meshes:
        me = o.data
        total_verts += len(me.vertices)
        total_tris += sum(max(1, len(p.vertices) - 2) for p in me.polygons)
        M = o.matrix_world
        for corner in o.bound_box:
            w = M @ Vector(corner)
            bmin[0] = min(bmin[0], w.x)
            bmin[1] = min(bmin[1], w.y)
            bmin[2] = min(bmin[2], w.z)
            bmax[0] = max(bmax[0], w.x)
            bmax[1] = max(bmax[1], w.y)
            bmax[2] = max(bmax[2], w.z)
        for ca in me.color_attributes:
            vcol_layers.add(f"{ca.name}({ca.domain}/{ca.data_type})")

    for m in bpy.data.materials:
        mat_names.append(m.name)
        alpha_modes.add(m.blend_method if hasattr(m, "blend_method") else "OPAQUE")

    textures = []
    for img in bpy.data.images:
        w, h = img.size[0], img.size[1]
        if w > 0 and h > 0:
            textures.append({"name": img.name, "size": [int(w), int(h)]})

    rec = {
        "file": str(path.relative_to(ROOT)),
        "size_mb": round(path.stat().st_size / (1024 * 1024), 2),
        "mesh_objects": len(meshes),
        "vertices": total_verts,
        "triangles": total_tris,
        "bbox_spec_enu": {
            "min": [round(v, 3) for v in bmin],
            "max": [round(v, 3) for v in bmax],
        },
        "color_attributes": sorted(vcol_layers),
        "materials_count": len(mat_names),
        "sample_materials": mat_names[:12],
        "textures_count": len(textures),
        "sample_textures": textures[:8],
    }
    results[key] = rec
    print(f"{key:26s} | {rec['size_mb']:5.2f} MB | {total_tris:7d} tris | {len(meshes):3d} objs | x=[{bmin[0]:6.1f},{bmax[0]:6.1f}] y=[{bmin[1]:6.1f},{bmax[1]:6.1f}] z=[{bmin[2]:5.2f},{bmax[2]:5.2f}] | vcol={sorted(vcol_layers)} | tex={len(textures)}")

OUT.write_text(json.dumps(results, indent=2, ensure_ascii=False))
print(f"Saved audit -> {OUT}")
