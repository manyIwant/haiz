"""Quick Cycles preview of the world: python tools/preview.py STATE out.png cx cy cz tx ty tz [fov] [spp] [w h]"""
import sys, math, pathlib
import bpy
from mathutils import Vector
ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "world"))
import lighting
a = sys.argv[1:]
state, out = a[0], a[1]
cam_p = Vector(map(float, a[2:5])); tgt = Vector(map(float, a[5:8]))
fov = float(a[8]) if len(a) > 8 else 60
spp = int(a[9]) if len(a) > 9 else 64
W, H = (int(a[10]), int(a[11])) if len(a) > 11 else (960, 540)
bpy.ops.wm.open_mainfile(filepath=str(ROOT / "assets/world.blend"))
for o in bpy.data.objects:
    if o.name in ("glass", "sash_glass"):
        o.hide_render = True
lighting.setup_blender(state, bpy, lamps=(state == "night"))
sc = bpy.context.scene
sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"
sc.cycles.samples = spp; sc.cycles.use_denoising = True; sc.cycles.denoiser = "OPENIMAGEDENOISE"
sc.cycles.max_bounces = 6
sc.render.resolution_x, sc.render.resolution_y = W, H
sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Medium High Contrast" if False else "None"
sc.view_settings.exposure = float(__import__("os").environ.get("EXPO", "0"))
cd = bpy.data.cameras.new("cam"); cd.angle = math.radians(fov); cd.clip_start = 0.05; cd.clip_end = 5000
if fov >= 179:
    cd.type = "PANO"; cd.panorama_type = "EQUIRECTANGULAR"
cam = bpy.data.objects.new("cam", cd); sc.collection.objects.link(cam)
cam.location = cam_p
cam.rotation_euler = (tgt - cam_p).to_track_quat("-Z", "Y").to_euler()
sc.camera = cam
sc.render.filepath = str(pathlib.Path(out).resolve())
bpy.ops.render.render(write_still=True)
