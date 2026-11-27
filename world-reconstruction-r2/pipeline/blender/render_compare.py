"""
HAIZ · World Reconstruction Round 2 — Closed-Loop Hero Comparison Renderer
=========================================================================
Supports matched-camera Cycles/EEVEE rendering of:
  - Our Round 2 hero landmarks (North Gate, Library & Observatory, Fengqitang & Yanlinting, Keji)
  - Inherited Atelier Master core (Yihao, Taihu, Terminalia, Forecourt)
  - Baseline PR #118 GLBs & Legacy HAIZ Phase-1 GLBs at the EXACT SAME CAMERAS
for honest, zero-distortion visual verification before full-campus rollout.
"""
import argparse
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Matrix, Vector

HERE = Path(__file__).resolve().parent
R2_ROOT = HERE.parents[1]
REPO_ROOT = R2_ROOT.parent
HDR_PATH = REPO_ROOT / "assets/walk/textures/campus-light.hdr"

sys.path.insert(0, str(HERE))
import pbr_materials  # noqa: E402
import arch_detail    # noqa: E402
sys.path.insert(0, str(HERE / "heroes"))
import hero_beimen    # noqa: E402
import hero_library   # noqa: E402
import hero_heritage  # noqa: E402
import hero_keji      # noqa: E402


# Exact matched inspection cameras (in canonical HAIZ-ENU-2026 meters)
CAMERAS = {
    # Exact calibrated hero-2560.report.json camera! (looking south at North Gate + Yihao down axis)
    "beimen_calib": {
        "eye": (0.439, 120.286, 1.500),
        "target": (0.05, 106.2, 4.95),
        "lens_mm": 28.9,  # f_px=2055.5 / 2560 * 36mm
        "shift_y": 0.145, # keystone-corrected principal point (row 1075 / 1347)
    },
    "beimen_oblique": {
        "eye": (-11.5, 124.5, 4.2),
        "target": (1.5, 106.2, 4.8),
        "lens_mm": 32.0,
        "shift_y": 0.0,
    },
    # Matched campus_library.jpg low-angle SW perspective looking NE at West grand stairs + arched barrel glass + South chamfered balconies + Observatory Dome!
    "library_calib": {
        "eye": (51.5, -31.5, 2.2),
        "target": (95.0, 1.5, 10.2),
        "lens_mm": 34.0,
        "shift_y": 0.06,
    },
    "library_oblique": {
        "eye": (56.0, 26.0, 14.5),
        "target": (96.0, 3.0, 8.5),
        "lens_mm": 34.0,
        "shift_y": 0.0,
    },
    # Matched campus_fengqitang.jpg frontal garden approach framing bronze scholar statue + Fengqitang emerald roof & wood columns
    "fengqitang_calib": {
        "eye": (-43.1, 47.0, 1.75),
        "target": (-43.1, 74.0, 3.2),
        "lens_mm": 34.0,
        "shift_y": 0.02,
    },
    # Matched campus_yanlintang.jpg 3/4 closeup of curved emerald roof, crimson soffit, couplets & Meirenkao benches
    "yanlinting_calib": {
        "eye": (23.8, 46.8, 1.75),
        "target": (34.0, 55.0, 3.2),
        "lens_mm": 35.0,
        "shift_y": 0.04,
    },
    # Matched campus_keji.jpg low-angle diagonal showing brown louvers, bronze double-height lobby & plaza
    "keji_calib": {
        "eye": (12.5, 58.5, 2.0),
        "target": (41.0, 84.5, 7.8),
        "lens_mm": 26.0,
        "shift_y": 0.06,
    },
}


def setup_lighting_and_render(scene: bpy.types.Scene, samples: int = 32, size=(1280, 800), use_cycles: bool = True):
    # Clean realistic tropical IBL from campus-light.hdr + clear Haikou afternoon sun
    if scene.world is None:
        scene.world = bpy.data.worlds.new("HaizR2World")
    world = scene.world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    if HDR_PATH.exists():
        env = nt.nodes.new("ShaderNodeTexEnvironment")
        img = bpy.data.images.load(str(HDR_PATH), check_existing=True)
        env.image = img
        bg.inputs["Strength"].default_value = 0.85
        nt.links.new(env.outputs["Color"], bg.inputs["Color"])
    else:
        bg.inputs["Color"].default_value = (0.58, 0.72, 0.88, 1.0)
        bg.inputs["Strength"].default_value = 0.7
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])

    # Warm crisp tropical sun (altitude ~38 deg, coming from SW/NW so north & west facades get sunlit relief)
    sun_data = bpy.data.lights.new("HaikouSun", type="SUN")
    sun_data.energy = 3.2
    sun_data.color = (1.0, 0.94, 0.84)
    sun_data.angle = math.radians(1.2)
    sun_obj = bpy.data.objects.new("HaikouSun", sun_data)
    sun_obj.rotation_euler = (math.radians(48), math.radians(-14), math.radians(28))
    scene.collection.objects.link(sun_obj)

    scene.render.resolution_x = size[0]
    scene.render.resolution_y = size[1]
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "JPEG"
    scene.render.image_settings.quality = 93
    scene.view_settings.view_transform = "AgX" if "AgX" in [e.identifier for e in scene.view_settings.bl_rna.properties["view_transform"].enum_items] else "Filmic"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.05

    if use_cycles:
        scene.render.engine = "CYCLES"
        scene.cycles.device = "CPU"
        scene.cycles.samples = samples
        scene.cycles.use_denoising = True
        scene.cycles.max_bounces = 6
        scene.cycles.diffuse_bounces = 3
        scene.cycles.glossy_bounces = 3
    else:
        scene.render.engine = "BLENDER_EEVEE"
        if hasattr(scene, "eevee"):
            scene.eevee.taa_render_samples = max(24, samples)


def add_camera(scene: bpy.types.Scene, name: str, cfg: dict) -> bpy.types.Object:
    cam_data = bpy.data.cameras.new(name)
    cam_data.lens = cfg["lens_mm"]
    cam_data.sensor_width = 36.0
    cam_data.shift_y = cfg.get("shift_y", 0.0)
    cam_data.clip_start = 0.2
    cam_data.clip_end = 1500.0
    cam = bpy.data.objects.new(name, cam_data)
    eye = Vector(cfg["eye"])
    tgt = Vector(cfg["target"])
    cam.location = eye
    direction = (tgt - eye).normalized()
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(cam)
    return cam


def build_stage_ground(mats: dict, coll: bpy.types.Collection):
    """Clean neutral context ground plane + North Gate forecourt apron & palm avenue context."""
    mb = arch_detail.R2Mesh(mats)
    # Surrounding lawn datum
    mb.quad((-220, -140, 0.14), (220, -140, 0.14), (220, 220, 0.14), (-220, 220, 0.14), "r2_ground_lawn", uv_scale=0.12)
    # Axis asphalt road & Dalu Street outside North Gate
    mb.box((-6.2, 48.0, -0.02), (6.2, 104.2, 0.005), "r2_ground_asphalt", uv_scale=0.18)
    mb.box((-80.0, 118.0, -0.02), (80.0, 134.0, 0.005), "r2_ground_asphalt", uv_scale=0.18)
    # North Gate granite apron (z=0.01 matching forecourt.glb site.ground.gate!)
    mb.box((-11.0, 102.0, -0.01), (11.0, 118.0, 0.012), "r2_paving_plaza", uv_scale=0.35)
    # Library apron
    mb.box((62.0, -28.0, 0.13), (122.0, 29.0, 0.16), "r2_paving_stagger", uv_scale=0.22)
    # Heritage courtyard paving around Fengqitang & lawn/walkways around Yanlinting
    mb.box((-58.0, 42.0, 0.13), (-28.0, 88.0, 0.16), "r2_paving_plaza", uv_scale=0.25)
    mb.box((28.0, 49.0, 0.145), (40.0, 61.0, 0.16), "r2_paving_plaza", uv_scale=0.25)
    # Keji foreground staggered plaza
    mb.box((8.0, 56.0, 0.13), (64.0, 99.0, 0.16), "r2_paving_stagger", uv_scale=0.20)
    mb.finalize("stage_ground", coll)


def render_r2_heroes(tag: str, targets: list[str], samples: int = 32, use_cycles: bool = True, out_dir: Path | None = None):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    coll = bpy.data.collections.new("R2_Heroes")
    scene.collection.children.link(coll)
    mats = pbr_materials.build_r2_materials()
    font = pbr_materials.load_cjk_font()

    build_stage_ground(mats, coll)
    if "beimen" in targets or "all" in targets:
        hero_beimen.build_beimen(mats, coll, font=font)
    if "library" in targets or "all" in targets:
        hero_library.build_library(mats, coll, font=font)
    if "heritage" in targets or "all" in targets:
        hero_heritage.build_heritage_complex(mats, coll, font=font)
    if "keji" in targets or "all" in targets:
        hero_keji.build_keji(mats, coll, font=font)

    # Also drop inherited Atelier Yihao & landmark briefly when rendering beimen_calib so axial framing matches real photo!
    if "beimen" in targets or "all" in targets:
        yihao_glb = REPO_ROOT / "twin/assets/atelier/yihao.glb"
        lm_glb = REPO_ROOT / "twin/assets/atelier/landmark.glb"
        if yihao_glb.exists():
            bpy.ops.import_scene.gltf(filepath=str(yihao_glb))
        if lm_glb.exists():
            bpy.ops.import_scene.gltf(filepath=str(lm_glb))

    setup_lighting_and_render(scene, samples=samples, size=(1200, 780), use_cycles=use_cycles)
    dest = out_dir or Path(f"/Users/a11/.gemini/antigravity/brain/0213b5cb-0365-4869-be17-edd2d36559fd/scratch/r2_audit/{tag}")
    dest.mkdir(parents=True, exist_ok=True)

    cam_map = []
    if "beimen" in targets or "all" in targets:
        cam_map += ["beimen_calib", "beimen_oblique"]
    if "library" in targets or "all" in targets:
        cam_map += ["library_calib", "library_oblique"]
    if "heritage" in targets or "all" in targets:
        cam_map += ["fengqitang_calib", "yanlinting_calib"]
    if "keji" in targets or "all" in targets:
        cam_map += ["keji_calib"]

    for cname in cam_map:
        scene.camera = add_camera(scene, cname, CAMERAS[cname])
        scene.render.filepath = str(dest / f"{cname}.jpg")
        bpy.ops.render.render(write_still=True)
        print(f"Rendered {tag} -> {cname}.jpg")


def render_baseline_glb_set(label: str, glb_paths: list[Path], cam_names: list[str], out_dir: Path, samples: int = 24):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    for gp in glb_paths:
        if gp.exists():
            bpy.ops.import_scene.gltf(filepath=str(gp))
    setup_lighting_and_render(scene, samples=samples, size=(1200, 780), use_cycles=False)
    out_dir.mkdir(parents=True, exist_ok=True)
    for cname in cam_names:
        scene.camera = add_camera(scene, cname, CAMERAS[cname])
        scene.render.filepath = str(out_dir / f"{cname}_{label}.jpg")
        bpy.ops.render.render(write_still=True)
        print(f"Rendered baseline {label} -> {cname}_{label}.jpg")


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", default="r2", choices=["r2", "baselines"])
    ap.add_argument("--tag", default="v1")
    ap.add_argument("--targets", default="all")
    ap.add_argument("--samples", type=int, default=24)
    ap.add_argument("--eevee", action="store_true")
    args = ap.parse_args(argv)

    if args.mode == "r2":
        render_r2_heroes(args.tag, args.targets.split(","), samples=args.samples, use_cycles=(not args.eevee))
    else:
        scratch = Path("/Users/a11/.gemini/antigravity/brain/0213b5cb-0365-4869-be17-edd2d36559fd/scratch/r2_audit/baselines")
        all_cams = list(CAMERAS.keys())
        # Legacy Phase-1 HAIZ models (twin/assets/phase1/{gate,campus,yihao}.glb)
        render_baseline_glb_set(
            "legacy",
            [REPO_ROOT / "twin/assets/phase1/gate.glb", REPO_ROOT / "twin/assets/phase1/campus.glb", REPO_ROOT / "twin/assets/atelier/yihao.glb", REPO_ROOT / "twin/assets/atelier/landmark.glb"],
            all_cams,
            scratch,
        )
        # PR #118 models
        pr118_dir = Path("/Users/a11/manyiwant/haiz-world-reconstruction/world-reconstruction/assets/districts")
        render_baseline_glb_set(
            "pr118",
            [
                pr118_dir / "terrain_campus.glb",
                pr118_dir / "d01_axis_forecourt_lod0.glb",
                pr118_dir / "d02_academic_core_lod0.glb",
                pr118_dir / "d04_heritage_gardens_lod0.glb",
                pr118_dir / "flora_kit.glb",
            ],
            all_cams,
            scratch,
        )
