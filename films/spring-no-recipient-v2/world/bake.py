"""Bake diffuse lighting (direct + indirect, without albedo) into lightmaps with Cycles,
denoise them with Intel Open Image Denoise (RTLightmap filter, the copy bundled with bpy),
and store them as log-encoded 8-bit PNGs for the Three.js renderer.

    /home/user/bpyenv/bin/python world/bake.py GROUPS STATES [samples] [res_scale]
    e.g.  world/bake.py room,furn dusk,morning 96

Output: assets/bake/<group>_<state>.png and assets/bake/index.json (encoding constants).
Value encoding (shared with film/world.js):  L = (exp2(v * K) - 1) / S  with v in 0..1.

Special state "<state>_nosun": the same sky with the sun switched off (used where the sun is
added back in real time, e.g. the shadow sweep in the classroom).
"""
import ctypes
import json
import math
import pathlib
import sys
import time

import bpy
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "world"))
import lighting  # noqa: E402

OUT = ROOT / "assets" / "bake"
OUT.mkdir(parents=True, exist_ok=True)
RES = {"room": 4096, "furn": 2048, "bldg": 4096, "station": 3072, "land": 2048}
K, S = 12.0, 64.0          # log encoding: covers 0 .. (2^12-1)/64 = 64 in linear units
# dark states are stored pre-multiplied so they keep enough 8-bit codes; film/world.js divides again
STATE_SCALE = {"dawn": 32.0, "night": 16.0, "dusk_nosun": 4.0, "morning_nosun": 4.0}


def oidn_denoise(rgb):
    lib = ctypes.CDLL(str(next(pathlib.Path(p) for p in sys.path if (pathlib.Path(p) / "bpy" / "lib" / "libOpenImageDenoise.so.2").exists()) / "bpy" / "lib" / "libOpenImageDenoise.so.2"))
    lib.oidnNewDevice.restype = ctypes.c_void_p
    lib.oidnNewFilter.restype = ctypes.c_void_p
    lib.oidnNewFilter.argtypes = [ctypes.c_void_p, ctypes.c_char_p]
    lib.oidnCommitDevice.argtypes = [ctypes.c_void_p]
    lib.oidnSetSharedFilterImage.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_void_p, ctypes.c_int,
                                             ctypes.c_size_t, ctypes.c_size_t, ctypes.c_size_t, ctypes.c_size_t, ctypes.c_size_t]
    lib.oidnCommitFilter.argtypes = [ctypes.c_void_p]
    lib.oidnExecuteFilter.argtypes = [ctypes.c_void_p]
    lib.oidnGetDeviceError.argtypes = [ctypes.c_void_p, ctypes.POINTER(ctypes.c_char_p)]
    dev = lib.oidnNewDevice(1)  # CPU
    lib.oidnCommitDevice(dev)
    # Blender's OIDN build ships only the generic "RT" weights (no RTLightmap), so run RT in HDR mode
    flt = lib.oidnNewFilter(dev, b"RT")
    lib.oidnSetFilterBool.argtypes = [ctypes.c_void_p, ctypes.c_char_p, ctypes.c_bool]
    lib.oidnSetFilterBool(flt, b"hdr", True)
    h, w, _ = rgb.shape
    src = np.ascontiguousarray(rgb, dtype=np.float32)
    dst = np.zeros_like(src)
    FLOAT3 = 3
    lib.oidnSetSharedFilterImage(flt, b"color", src.ctypes.data, FLOAT3, w, h, 0, 0, 0)
    lib.oidnSetSharedFilterImage(flt, b"output", dst.ctypes.data, FLOAT3, w, h, 0, 0, 0)
    lib.oidnCommitFilter(flt)
    lib.oidnExecuteFilter(flt)
    err = ctypes.c_char_p()
    if lib.oidnGetDeviceError(dev, ctypes.byref(err)):
        print("OIDN error:", err.value)
        return rgb
    return dst


def encode_png(rgb, path):
    from PIL import Image
    v = np.log2(1.0 + np.clip(rgb, 0, None) * S) / K
    rng = np.random.default_rng(0)
    v = v * 255.0 + (rng.random(v.shape) - rng.random(v.shape)) * 0.5
    a = np.clip(v + 0.5, 0, 255).astype(np.uint8)
    Image.fromarray(a[::-1]).save(path, optimize=True)   # Blender images are bottom-up


def prepare(group_names):
    for o in bpy.data.objects:
        if o.name in ("glass", "sash_glass"):
            o.hide_render = True
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.max_bounces = 8
    sc.cycles.diffuse_bounces = 6
    sc.cycles.use_denoising = False
    sc.render.bake.margin = 6
    sc.render.bake.margin_type = "EXTEND"
    sc.render.bake.use_pass_direct = True
    sc.render.bake.use_pass_indirect = True
    sc.render.bake.use_pass_color = False


def bake_group(gname, res, tag):
    ob = bpy.data.objects[gname]
    img = bpy.data.images.new(f"LM_{gname}_{tag}", res, res, float_buffer=True, alpha=False)
    me = ob.data
    me.uv_layers.active = me.uv_layers["LM"]
    for slot in ob.material_slots:
        nt = slot.material.node_tree
        n = nt.nodes.get("BAKE_TARGET") or nt.nodes.new("ShaderNodeTexImage")
        n.name = "BAKE_TARGET"
        n.image = img
        n.select = True
        nt.nodes.active = n
    for o in bpy.context.view_layer.objects:
        o.select_set(o == ob)
    bpy.context.view_layer.objects.active = ob
    t = time.time()
    bpy.ops.object.bake(type="DIFFUSE", pass_filter={"DIRECT", "INDIRECT"}, margin=6, use_clear=True)
    px = np.array(img.pixels[:], dtype=np.float32).reshape(res, res, 4)[..., :3]
    print(f"  baked {gname}/{tag} {res}px in {time.time() - t:.0f}s, mean {px.mean():.3f}", flush=True)
    me.uv_layers.active = me.uv_layers["UVMap"]
    bpy.data.images.remove(img)
    return px


def main():
    groups = sys.argv[1].split(",")
    states = sys.argv[2].split(",")
    spp = int(sys.argv[3]) if len(sys.argv) > 3 else 96
    scale = float(sys.argv[4]) if len(sys.argv) > 4 else 1.0
    bpy.ops.wm.open_mainfile(filepath=str(ROOT / "assets" / "world.blend"))
    prepare(groups)
    bpy.context.scene.cycles.samples = spp
    idx_path = OUT / "index.json"
    index = json.loads(idx_path.read_text()) if idx_path.exists() else {}
    index["encoding"] = dict(K=K, S=S)
    for st in states:
        base = st.replace("_nosun", "")
        nosun = st.endswith("_nosun")
        lighting.setup_blender(base, bpy, lamps=(base == "night"), sun_strength=0.0 if nosun else None)
        for g in groups:
            res = int(RES[g] * scale)
            px = bake_group(g, res, st)
            t = time.time()
            den = oidn_denoise(px)
            sc = STATE_SCALE.get(st, 1.0)
            encode_png(den * sc, OUT / f"{g}_{st}.png")
            raw = ROOT / "build" / "bake_raw"; raw.mkdir(parents=True, exist_ok=True)
            np.save(raw / f"{g}_{st}.npy", den.astype(np.float16))
            index.setdefault(g, {})[st] = dict(file=f"{g}_{st}.png", res=res, spp=spp, scale=sc)
            print(f"  denoised+saved {g}_{st} ({time.time() - t:.0f}s)", flush=True)
            idx_path.write_text(json.dumps(index, indent=1))


if __name__ == "__main__":
    main()
