"""
HAIZ · World Reconstruction Round 2 — High-Craft PBR Materials & Calligraphy Generator
=====================================================================================
Pure NumPy + bpy procedural PBR texture synthesis combined with existing HAIZ repository
CC0 photographic PBR maps (assets/walk/textures/*) + genuine macOS Songti 3D CJK meshes.
"""
from pathlib import Path
import math
import bpy
import numpy as np
from mathutils import Matrix

REPO_ROOT = Path("/Users/a11/manyiwant/haiz-world-reconstruction-r2")
WALK_TEX = REPO_ROOT / "assets/walk/textures"

# macOS system calligraphy serif & regular brush fonts for authentic plaque/couplet 3D relief
CJK_FONT_CANDIDATES = [
    Path("/System/Library/AssetsV2/com_apple_MobileAsset_Font8/13b8ce423f920875b28b551f9406bf1014e0a656.asset/AssetData/Xingkai.ttc"),
    Path("/System/Library/AssetsV2/com_apple_MobileAsset_Font8/6331c5916c361af1b83fb8b8b76ef2eece20c8eb.asset/AssetData/Kai.ttf"),
    Path("/System/Library/AssetsV2/com_apple_MobileAsset_Font8/6372627020b45393e500bb1661c460d4a93aff49.asset/AssetData/LiSongPro.ttf"),
    Path("/System/Library/Fonts/Hiragino Sans GB.ttc"),
    Path("/System/Library/Fonts/STHeiti Medium.ttc"),
]


def _value_noise(h: int, w: int, sy: int, sx: int, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    grid = rng.uniform(0.0, 1.0, (sy, sx)).astype(np.float32)
    y = np.linspace(0, sy, h, endpoint=False, dtype=np.float32)
    x = np.linspace(0, sx, w, endpoint=False, dtype=np.float32)
    yi = np.floor(y).astype(np.int32)
    xi = np.floor(x).astype(np.int32)
    yf = y - yi
    xf = x - xi
    yf = yf * yf * (3.0 - 2.0 * yf)
    xf = xf * xf * (3.0 - 2.0 * xf)
    y0, y1 = yi % sy, (yi + 1) % sy
    x0, x1 = xi % sx, (xi + 1) % sx
    top = grid[np.ix_(y0, x0)] * (1.0 - xf[None, :]) + grid[np.ix_(y0, x1)] * xf[None, :]
    bot = grid[np.ix_(y1, x0)] * (1.0 - xf[None, :]) + grid[np.ix_(y1, x1)] * xf[None, :]
    return top * (1.0 - yf[:, None]) + bot * yf[:, None]


def _fbm(h: int, w: int, octaves: list[tuple[int, int, float]], seed: int) -> np.ndarray:
    acc = np.zeros((h, w), dtype=np.float32)
    norm = 0.0
    for i, (sy, sx, amp) in enumerate(octaves):
        acc += _value_noise(h, w, sy, sx, seed + i * 79) * amp
        norm += amp
    return acc / max(norm, 1e-6)


def _height_to_normal(height: np.ndarray, strength: float = 2.0) -> np.ndarray:
    gx = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * 0.5 * strength
    gy = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * 0.5 * strength
    nx, ny, nz = -gx, -gy, np.ones_like(height)
    inv = 1.0 / np.sqrt(nx * nx + ny * ny + nz * nz + 1e-8)
    return np.clip(np.stack([nx * inv * 0.5 + 0.5, ny * inv * 0.5 + 0.5, nz * inv * 0.5 + 0.5], axis=-1), 0.0, 1.0)


def _create_image(name: str, rgb_or_rgba: np.ndarray, colorspace: str = "sRGB") -> bpy.types.Image:
    if name in bpy.data.images:
        bpy.data.images.remove(bpy.data.images[name])
    arr = np.asarray(rgb_or_rgba, dtype=np.float32)
    h, w = arr.shape[:2]
    rgba = (
        np.concatenate([arr, np.ones((h, w, 1), dtype=np.float32)], axis=-1)
        if arr.shape[2] == 3
        else arr
    )
    img = bpy.data.images.new(name=name, width=w, height=h, alpha=(arr.shape[2] == 4))
    img.colorspace_settings.name = colorspace
    img.pixels.foreach_set(np.flipud(rgba).ravel().astype(np.float32))
    img.pack()
    return img


def _load_walk_image(filename: str, colorspace: str = "sRGB") -> bpy.types.Image | None:
    p = WALK_TEX / filename
    if not p.exists():
        return None
    name = f"walk_{filename}"
    if name in bpy.data.images:
        return bpy.data.images[name]
    img = bpy.data.images.load(str(p))
    img.name = name
    img.colorspace_settings.name = colorspace
    img.pack()
    return img


def _make_pbr(
    name: str,
    base_color=(0.8, 0.8, 0.8, 1.0),
    roughness: float = 0.65,
    metallic: float = 0.0,
    albedo_img: bpy.types.Image | None = None,
    normal_img: bpy.types.Image | None = None,
    normal_strength: float = 0.75,
    rough_img: bpy.types.Image | None = None,
    tint_mul=None,
    uv_scale=(1.0, 1.0),
    double_sided: bool = False,
    coat_weight: float = 0.0,
    coat_roughness: float = 0.12,
    alpha_clip: bool = False,
    transmission: float = 0.0,
    ior: float = 1.5,
    weathering_z: bool = False,
) -> bpy.types.Material:
    if name in bpy.data.materials:
        bpy.data.materials.remove(bpy.data.materials[name])
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    mat.use_backface_culling = not double_sided
    nt = mat.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

    bsdf.inputs["Base Color"].default_value = base_color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if "Coat Weight" in bsdf.inputs and coat_weight > 0:
        bsdf.inputs["Coat Weight"].default_value = coat_weight
        bsdf.inputs["Coat Roughness"].default_value = coat_roughness
    if "Transmission Weight" in bsdf.inputs and transmission > 0:
        bsdf.inputs["Transmission Weight"].default_value = transmission
    if "IOR" in bsdf.inputs:
        bsdf.inputs["IOR"].default_value = ior

    tex_coord = nt.nodes.new("ShaderNodeTexCoord")
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (uv_scale[0], uv_scale[1], 1.0)
    nt.links.new(tex_coord.outputs["UV"], mapping.inputs["Vector"])

    color_out = None
    if albedo_img is not None:
        tex_a = nt.nodes.new("ShaderNodeTexImage")
        tex_a.image = albedo_img
        nt.links.new(mapping.outputs["Vector"], tex_a.inputs["Vector"])
        color_out = tex_a.outputs["Color"]
        if tint_mul is not None:
            mix = nt.nodes.new("ShaderNodeMix")
            mix.data_type = "RGBA"
            mix.blend_type = "MULTIPLY"
            mix.inputs["Factor"].default_value = 1.0
            mix.inputs[7].default_value = tint_mul
            nt.links.new(color_out, mix.inputs[6])
            color_out = mix.outputs[2]
        if alpha_clip:
            mat.blend_method = "CLIP" if hasattr(mat, "blend_method") else "OPAQUE"
            nt.links.new(tex_a.outputs["Alpha"], bsdf.inputs["Alpha"])

    # Subtle lower-wall tropical rain-splash / moss weathering gradient (real Hainan humidity patina)
    if weathering_z:
        geom = nt.nodes.new("ShaderNodeNewGeometry")
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        nt.links.new(geom.outputs["Position"], sep.inputs["Vector"])
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].position = 0.04
        ramp.color_ramp.elements[0].color = (0.83, 0.84, 0.78, 1.0)
        ramp.color_ramp.elements[1].position = 0.95
        ramp.color_ramp.elements[1].color = (1.0, 1.0, 1.0, 1.0)
        nt.links.new(sep.outputs["Z"], ramp.inputs["Fac"])

        if color_out is None:
            val_col = nt.nodes.new("ShaderNodeRGB")
            val_col.outputs[0].default_value = base_color
            color_out = val_col.outputs[0]

        wmix = nt.nodes.new("ShaderNodeMix")
        wmix.data_type = "RGBA"
        wmix.blend_type = "MULTIPLY"
        wmix.inputs["Factor"].default_value = 0.75
        nt.links.new(color_out, wmix.inputs[6])
        nt.links.new(ramp.outputs["Color"], wmix.inputs[7])
        color_out = wmix.outputs[2]

    if color_out is not None:
        nt.links.new(color_out, bsdf.inputs["Base Color"])

    if normal_img is not None:
        tex_n = nt.nodes.new("ShaderNodeTexImage")
        tex_n.image = normal_img
        nt.links.new(mapping.outputs["Vector"], tex_n.inputs["Vector"])
        nrm = nt.nodes.new("ShaderNodeNormalMap")
        nrm.inputs["Strength"].default_value = normal_strength
        nt.links.new(tex_n.outputs["Color"], nrm.inputs["Color"])
        nt.links.new(nrm.outputs["Normal"], bsdf.inputs["Normal"])

    if rough_img is not None:
        tex_r = nt.nodes.new("ShaderNodeTexImage")
        tex_r.image = rough_img
        nt.links.new(mapping.outputs["Vector"], tex_r.inputs["Vector"])
        sep_r = nt.nodes.new("ShaderNodeSeparateColor")
        nt.links.new(tex_r.outputs["Color"], sep_r.inputs["Color"])
        nt.links.new(sep_r.outputs["Green"], bsdf.inputs["Roughness"])

    return mat


def _gen_ceramic_mosaic(name: str, base_rgb, mortar_rgb, cols: int, rows: int, var: float, seed: int, size: int = 512):
    """Fine architectural exterior ceramic tile grid (as on Hainan Middle School Library & Keji)."""
    y = np.linspace(0, 1, size, endpoint=False, dtype=np.float32)[:, None]
    x = np.linspace(0, 1, size, endpoint=False, dtype=np.float32)[None, :]
    fx = (x * cols) % 1.0
    fy = (y * rows) % 1.0
    cid = (np.floor(x * cols).astype(np.int32)) % cols
    rid = (np.floor(y * rows).astype(np.int32)) % rows
    rng = np.random.default_rng(seed)
    tile_v = rng.uniform(-var, var, (rows, cols)).astype(np.float32)[rid, cid]
    mortar = ((fx < 0.055) | (fx > 0.945) | (fy < 0.08) | (fy > 0.92)).astype(np.float32)
    micro = _fbm(size, size, [(4, 4, 0.45), (16, 16, 0.35), (48, 48, 0.2)], seed + 13)

    base = np.array(base_rgb, dtype=np.float32)
    mcol = np.array(mortar_rgb, dtype=np.float32)
    tile_col = base[None, None, :] * (0.93 + 0.14 * micro[:, :, None] + tile_v[:, :, None])
    rgb = tile_col * (1.0 - mortar[:, :, None]) + mcol[None, None, :] * mortar[:, :, None]
    height = np.clip((1.0 - 0.72 * mortar) * (0.7 + 0.3 * micro), 0.0, 1.0)
    rough = np.clip(0.38 + 0.18 * (1.0 - micro) + 0.42 * mortar, 0.25, 0.95)
    return (
        _create_image(f"r2_{name}_col", np.clip(rgb, 0.0, 1.0), "sRGB"),
        _create_image(f"r2_{name}_nrm", _height_to_normal(height, 1.5), "Non-Color"),
        _create_image(f"r2_{name}_rgh", np.repeat(rough[:, :, None], 3, axis=-1), "Non-Color"),
    )


def _gen_glazed_tile_tex(name: str, bright_rgb, valley_rgb, seed: int, size: int = 512):
    """Glossy Lingnan glazed barrel tile texture with dark ridge shadows & slight moss patina."""
    y = np.linspace(0, 1, size, endpoint=False, dtype=np.float32)[:, None]
    x = np.linspace(0, 1, size, endpoint=False, dtype=np.float32)[None, :]
    n_ribs = 12
    phase = x * n_ribs * 2.0 * math.pi
    arch = 0.5 + 0.5 * np.cos(phase)  # 1 at barrel crest, 0 in deep valley
    course = (y * 14) % 1.0
    lap = np.exp(-((course) / 0.09) ** 2) * 0.55

    patina = _fbm(size, size, [(5, 5, 0.45), (16, 16, 0.35), (42, 42, 0.2)], seed)
    c_b = np.array(bright_rgb, dtype=np.float32)
    c_v = np.array(valley_rgb, dtype=np.float32)
    rgb = (c_v[None, None, :] * (1.0 - arch[:, :, None]) + c_b[None, None, :] * arch[:, :, None]) * (0.86 + 0.28 * patina[:, :, None])
    rgb = rgb * (1.0 - 0.26 * lap[:, :, None])
    height = np.clip(0.2 + 0.65 * arch - 0.22 * lap + 0.12 * patina, 0.0, 1.0)
    rough = np.clip(0.18 + 0.24 * (1.0 - arch) + 0.22 * (1.0 - patina), 0.12, 0.68)
    return (
        _create_image(f"r2_{name}_col", np.clip(rgb, 0.0, 1.0), "sRGB"),
        _create_image(f"r2_{name}_nrm", _height_to_normal(height, 2.2), "Non-Color"),
        _create_image(f"r2_{name}_rgh", np.repeat(rough[:, :, None], 3, axis=-1), "Non-Color"),
    )


def _gen_wood_grain(name: str, base_rgb, dark_rgb, seed: int, size: int = 512):
    """Varnished tropical hardwood / mahogany lacquer grain for Fengqitang & Yanlinting."""
    y = np.linspace(0, 1, size, endpoint=False, dtype=np.float32)[:, None]
    x = np.linspace(0, 1, size, endpoint=False, dtype=np.float32)[None, :]
    streak = _fbm(size, size, [(2, 24, 0.55), (6, 48, 0.3), (18, 96, 0.15)], seed)
    rings = 0.5 + 0.5 * np.sin((x * 16.0 + streak * 4.5) * math.pi)
    c1 = np.array(base_rgb, dtype=np.float32)
    c2 = np.array(dark_rgb, dtype=np.float32)
    rgb = (c2[None, None, :] * (1.0 - rings[:, :, None]) + c1[None, None, :] * rings[:, :, None]) * (0.88 + 0.22 * streak[:, :, None])
    rough = np.clip(0.24 + 0.18 * (1.0 - rings) + 0.14 * (1.0 - streak), 0.16, 0.58)
    return (
        _create_image(f"r2_{name}_col", np.clip(rgb, 0.0, 1.0), "sRGB"),
        _create_image(f"r2_{name}_nrm", _height_to_normal(0.5 + 0.35 * rings + 0.15 * streak, 1.2), "Non-Color"),
        _create_image(f"r2_{name}_rgh", np.repeat(rough[:, :, None], 3, axis=-1), "Non-Color"),
    )


def _gen_smooth_plaster(name: str, base_rgb, seed: int, var: float = 0.03, size: int = 512):
    """Fine architectural stucco / lime plaster texture without blotchy macro noise."""
    fine = _fbm(size, size, [(12, 12, 0.35), (36, 36, 0.4), (96, 96, 0.25)], seed)
    c0 = np.array(base_rgb, dtype=np.float32)
    rgb = c0[None, None, :] * (1.0 - var * 0.5 + var * fine[:, :, None])
    height = 0.5 + 0.22 * fine
    rough = np.clip(0.68 + 0.14 * (1.0 - fine), 0.50, 0.88)
    return (
        _create_image(f"r2_{name}_col", np.clip(rgb, 0.0, 1.0), "sRGB"),
        _create_image(f"r2_{name}_nrm", _height_to_normal(height, 0.8), "Non-Color"),
        _create_image(f"r2_{name}_rgh", np.repeat(rough[:, :, None], 3, axis=-1), "Non-Color"),
    )


def _gen_granite_stone(name: str, base_rgb, fleck_rgb, seed: int, size: int = 512, joints: tuple[int, int] | None = None):
    grain = _fbm(size, size, [(8, 8, 0.3), (28, 28, 0.4), (72, 72, 0.3)], seed)
    speck = _value_noise(size, size, 128, 128, seed + 41)
    c0 = np.array(base_rgb, dtype=np.float32)
    c1 = np.array(fleck_rgb, dtype=np.float32)
    rgb = c0[None, None, :] * (0.86 + 0.16 * grain[:, :, None]) + c1[None, None, :] * (speck[:, :, None] * 0.16)
    height = 0.65 + 0.25 * grain + 0.1 * speck
    if joints is not None:
        cols, rows = joints
        y = np.linspace(0, 1, size, endpoint=False, dtype=np.float32)[:, None]
        x = np.linspace(0, 1, size, endpoint=False, dtype=np.float32)[None, :]
        fx = (x * cols) % 1.0
        fy = (y * rows) % 1.0
        m = ((fx < 0.03) | (fx > 0.97) | (fy < 0.035) | (fy > 0.965)).astype(np.float32)
        rgb *= 1.0 - 0.32 * m[:, :, None]
        height -= 0.4 * m
    rough = np.clip(0.56 + 0.22 * (1.0 - grain), 0.36, 0.88)
    return (
        _create_image(f"r2_{name}_col", np.clip(rgb, 0.0, 1.0), "sRGB"),
        _create_image(f"r2_{name}_nrm", _height_to_normal(np.clip(height, 0.0, 1.0), 1.8), "Non-Color"),
        _create_image(f"r2_{name}_rgh", np.repeat(rough[:, :, None], 3, axis=-1), "Non-Color"),
    )


def _gen_keji_louver_tex(size: int = 256):
    """Dark warm brown exterior horizontal louver grilles visible on campus_keji.jpg."""
    y = np.linspace(0, 1, size, endpoint=False, dtype=np.float32)[:, None]
    fy = (y * 16) % 1.0
    slat = np.clip(np.sin(fy * math.pi) * 1.15, 0.15, 1.0)
    dark = np.array([0.08, 0.055, 0.04], dtype=np.float32)
    wood = np.array([0.33, 0.22, 0.14], dtype=np.float32)
    rgb = dark[None, None, :] * (1.0 - slat[:, :, None]) + wood[None, None, :] * slat[:, :, None]
    rgb = np.repeat(rgb, size, axis=1)
    height = np.repeat(slat, size, axis=1)
    return (
        _create_image("r2_louver_col", rgb, "sRGB"),
        _create_image("r2_louver_nrm", _height_to_normal(height, 2.5), "Non-Color"),
    )


def _gen_stagger_plaza(size: int = 512):
    """Dark granite outdoor plaza with pale square accents (campus_keji.jpg foreground!)."""
    y = np.linspace(0, 1, size, endpoint=False, dtype=np.float32)[:, None]
    x = np.linspace(0, 1, size, endpoint=False, dtype=np.float32)[None, :]
    n = 8
    ix = np.floor(x * n).astype(np.int32)
    iy = np.floor(y * n).astype(np.int32)
    fx, fy = (x * n) % 1.0, (y * n) % 1.0
    accent = (((ix % 3 == 1) & (iy % 3 == 1))).astype(np.float32)
    joint = ((fx < 0.03) | (fx > 0.97) | (fy < 0.03) | (fy > 0.97)).astype(np.float32)
    grain = _fbm(size, size, [(8, 8, 0.5), (36, 36, 0.5)], 881)
    c_dark = np.array([0.30, 0.30, 0.29], dtype=np.float32)
    c_light = np.array([0.69, 0.67, 0.62], dtype=np.float32)
    rgb = c_dark[None, None, :] * (1.0 - accent[:, :, None]) + c_light[None, None, :] * accent[:, :, None]
    rgb *= 0.88 + 0.22 * grain[:, :, None]
    rgb *= 1.0 - 0.28 * joint[:, :, None]
    height = np.clip(0.8 - 0.45 * joint + 0.16 * grain, 0.0, 1.0)
    return (
        _create_image("r2_stagger_col", np.clip(rgb, 0.0, 1.0), "sRGB"),
        _create_image("r2_stagger_nrm", _height_to_normal(height, 1.8), "Non-Color"),
    )


def _gen_track_lane_tex(size: int = 512):
    """Authentic synthetic red-clay athletics running track with crisp white lane stripes."""
    y = np.linspace(0, 1, size, endpoint=False, dtype=np.float32)[:, None]
    grain = _fbm(size, size, [(12, 12, 0.4), (64, 64, 0.6)], 517)
    track = np.array([0.62, 0.25, 0.19], dtype=np.float32)
    rgb = track[None, None, :] * (0.90 + 0.18 * grain[:, :, None])
    lanes = ((y * 8) % 1.0 < 0.065).astype(np.float32)
    white = np.array([0.92, 0.91, 0.88], dtype=np.float32)
    rgb = rgb * (1.0 - lanes[:, :, None]) + white[None, None, :] * lanes[:, :, None]
    return _create_image("r2_track_col", np.clip(rgb, 0.0, 1.0), "sRGB")


def _gen_court_tex(size: int = 512):
    """Authentic Fucheng basketball court (teal-green inner court, terracotta surround, crisp white lines)."""
    y = np.linspace(0, 1, size, endpoint=False, dtype=np.float32)[:, None]
    x = np.linspace(0, 1, size, endpoint=False, dtype=np.float32)[None, :]
    grain = _fbm(size, size, [(8, 8, 0.5), (32, 32, 0.5)], 621)
    jade = np.array([0.16, 0.43, 0.35], dtype=np.float32)
    terra = np.array([0.64, 0.27, 0.20], dtype=np.float32)
    margin = ((x < 0.08) | (x > 0.92) | (y < 0.08) | (y > 0.92)).astype(np.float32)
    rgb = (jade[None, None, :] * (1.0 - margin[:, :, None]) + terra[None, None, :] * margin[:, :, None]) + 0.0 * grain[:, :, None]
    # Center circle & boundary & key lines
    line = (
        (np.abs(x - 0.08) < 0.012) | (np.abs(x - 0.92) < 0.012) |
        (np.abs(y - 0.08) < 0.012) | (np.abs(y - 0.92) < 0.012) |
        (np.abs(y - 0.50) < 0.010) |
        (np.abs(np.hypot(x - 0.5, (y - 0.5) * 1.75) - 0.18) < 0.012)
    ).astype(np.float32)
    rgb = (rgb * (0.90 + 0.16 * grain[:, :, None])) * (1.0 - line[:, :, None]) + np.array([0.94, 0.94, 0.92])[None, None, :] * line[:, :, None]
    return _create_image("r2_court_col", np.clip(rgb, 0.0, 1.0), "sRGB")


def build_r2_materials() -> dict[str, bpy.types.Material]:
    """Build complete unified Round 2 photographic-grade PBR material library."""
    mats: dict[str, bpy.types.Material] = {}

    # Existing repository CC0 PBR maps
    w_pave_c = _load_walk_image("paving-color.jpg", "sRGB")
    w_pave_n = _load_walk_image("paving-normal.jpg", "Non-Color")
    w_pave_r = _load_walk_image("paving-rough.jpg", "Non-Color")
    w_plaster_c = _load_walk_image("plaster-color.jpg", "sRGB")
    w_plaster_n = _load_walk_image("plaster-normal.jpg", "Non-Color")
    w_plaster_r = _load_walk_image("plaster-rough.jpg", "Non-Color")
    w_grass_c = _load_walk_image("grass-color.jpg", "sRGB")
    w_grass_n = _load_walk_image("grass-normal.jpg", "Non-Color")
    w_grass_r = _load_walk_image("grass-rough.jpg", "Non-Color")
    w_wood_c = _load_walk_image("wood-color.jpg", "sRGB")
    w_wood_n = _load_walk_image("wood-normal.jpg", "Non-Color")
    w_leaf_c = _load_walk_image("terminalia-leaves.webp", "sRGB")

    # 1. Glazed Roof Tiles (Real glazed ceramic specular coat + valley contrast)
    eg_c, eg_n, eg_r = _gen_glazed_tile_tex("emerald_roof", (0.09, 0.45, 0.28), (0.025, 0.16, 0.10), 101)
    mats["r2_roof_emerald"] = _make_pbr(
        "r2_roof_emerald", base_color=(0.08, 0.42, 0.26, 1.0), roughness=0.24,
        albedo_img=eg_c, normal_img=eg_n, normal_strength=0.95, rough_img=eg_r, coat_weight=0.55, coat_roughness=0.10
    )
    tr_c, tr_n, tr_r = _gen_glazed_tile_tex("terracotta_roof", (0.72, 0.21, 0.14), (0.32, 0.08, 0.05), 102)
    mats["r2_roof_terracotta"] = _make_pbr(
        "r2_roof_terracotta", base_color=(0.70, 0.21, 0.14, 1.0), roughness=0.28,
        albedo_img=tr_c, normal_img=tr_n, normal_strength=0.9, rough_img=tr_r, coat_weight=0.35
    )

    # 2. Facade Cladding & Stucco (clean sunlit Haikou cream/ivory + bright white mosaic w/ gentle base humidity patina)
    stucco_c, stucco_n, stucco_r = _gen_smooth_plaster("cream_stucco", (0.94, 0.91, 0.85), 301, var=0.032)
    mats["r2_stucco_cream"] = _make_pbr(
        "r2_stucco_cream", base_color=(0.94, 0.91, 0.85, 1.0), roughness=0.72,
        albedo_img=stucco_c, normal_img=stucco_n, normal_strength=0.16, rough_img=stucco_r,
        uv_scale=(0.35, 0.35), weathering_z=True
    )
    mos_c, mos_n, mos_r = _gen_ceramic_mosaic("white_mosaic", (0.96, 0.96, 0.95), (0.87, 0.87, 0.86), 24, 48, 0.015, 201)
    mats["r2_wall_white_mosaic"] = _make_pbr(
        "r2_wall_white_mosaic", base_color=(0.96, 0.96, 0.95, 1.0), roughness=0.44,
        albedo_img=mos_c, normal_img=mos_n, normal_strength=0.38, rough_img=mos_r, weathering_z=True
    )
    wmat_c, wmat_n, wmat_r = _gen_smooth_plaster("white_matte", (0.95, 0.94, 0.92), 302, var=0.025)
    mats["r2_wall_white_matte"] = _make_pbr(
        "r2_wall_white_matte", base_color=(0.95, 0.94, 0.92, 1.0), roughness=0.72,
        albedo_img=wmat_c, normal_img=wmat_n, normal_strength=0.14,
        uv_scale=(0.35, 0.35), weathering_z=True
    )
    ch_c, ch_n, ch_r = _gen_smooth_plaster("champagne_wall", (0.84, 0.77, 0.66), 303, var=0.035)
    mats["r2_wall_champagne"] = _make_pbr(
        "r2_wall_champagne", base_color=(0.84, 0.77, 0.66, 1.0), roughness=0.66,
        albedo_img=ch_c, normal_img=ch_n, normal_strength=0.18,
        uv_scale=(0.35, 0.35), weathering_z=True
    )
    mats["r2_wall_terracotta_plinth"] = _make_pbr(
        "r2_wall_terracotta_plinth", base_color=(0.68, 0.44, 0.39, 1.0), roughness=0.68,
        albedo_img=mos_c, normal_img=mos_n, normal_strength=0.5, tint_mul=(0.76, 0.50, 0.44, 1.0)
    )
    mats["r2_trim_white"] = _make_pbr("r2_trim_white", (0.94, 0.93, 0.90, 1.0), roughness=0.52)
    mats["r2_trim_coral"] = _make_pbr("r2_trim_coral", (0.83, 0.66, 0.62, 1.0), roughness=0.58)
    mats["r2_soffit_shadow"] = _make_pbr("r2_soffit_shadow", (0.28, 0.27, 0.25, 1.0), roughness=0.82)

    # 3. Traditional Gate, Heritage Hall & Pavilion Finishes
    mats["r2_fret_green"] = _make_pbr("r2_fret_green", (0.06, 0.34, 0.21, 1.0), roughness=0.38, coat_weight=0.2)
    mats["r2_fret_ochre"] = _make_pbr("r2_fret_ochre", (0.76, 0.48, 0.14, 1.0), roughness=0.40)
    mats["r2_gold_leaf"] = _make_pbr("r2_gold_leaf", (0.85, 0.66, 0.22, 1.0), roughness=0.26, metallic=0.82)
    gw_c, gw_n, gw_r = _gen_wood_grain("gold_timber", (0.64, 0.38, 0.14), (0.44, 0.24, 0.08), 305)
    mats["r2_wood_golden"] = _make_pbr(
        "r2_wood_golden", (0.62, 0.36, 0.13, 1.0), roughness=0.32,
        albedo_img=gw_c, normal_img=gw_n, normal_strength=0.55, rough_img=gw_r, coat_weight=0.38
    )
    mah_c, mah_n, mah_r = _gen_wood_grain("mahogany", (0.36, 0.12, 0.07), (0.18, 0.05, 0.03), 306)
    mats["r2_wood_mahogany"] = _make_pbr(
        "r2_wood_mahogany", (0.34, 0.11, 0.07, 1.0), roughness=0.28,
        albedo_img=mah_c, normal_img=mah_n, normal_strength=0.45, rough_img=mah_r, coat_weight=0.42
    )
    crim_c, crim_n, crim_r = _gen_wood_grain("crimson_lacquer", (0.45, 0.08, 0.06), (0.24, 0.03, 0.025), 307)
    mats["r2_lacquer_crimson"] = _make_pbr(
        "r2_lacquer_crimson", (0.42, 0.07, 0.05, 1.0), roughness=0.24,
        albedo_img=crim_c, normal_img=crim_n, normal_strength=0.4, rough_img=crim_r, coat_weight=0.55
    )

    # 4. Stone, Granite, Bronze & Statue
    gg_c, gg_n, gg_r = _gen_granite_stone("granite_grey", (0.62, 0.61, 0.58), (0.32, 0.32, 0.30), 401, joints=(6, 4))
    mats["r2_stone_granite_grey"] = _make_pbr(
        "r2_stone_granite_grey", (0.62, 0.61, 0.58, 1.0), roughness=0.60,
        albedo_img=gg_c, normal_img=gg_n, normal_strength=0.75, rough_img=gg_r, weathering_z=True
    )
    gd_c, gd_n, gd_r = _gen_granite_stone("granite_dark", (0.26, 0.27, 0.26), (0.12, 0.13, 0.12), 402, joints=(8, 6))
    mats["r2_stone_granite_dark"] = _make_pbr(
        "r2_stone_granite_dark", (0.26, 0.27, 0.26, 1.0), roughness=0.52,
        albedo_img=gd_c, normal_img=gd_n, normal_strength=0.75, rough_img=gd_r
    )
    lion_c, lion_n, lion_r = _gen_granite_stone("lion_carved", (0.78, 0.77, 0.72), (0.52, 0.50, 0.45), 403, joints=None)
    mats["r2_stone_carved_pale"] = _make_pbr(
        "r2_stone_carved_pale", (0.78, 0.77, 0.72, 1.0), roughness=0.68,
        albedo_img=lion_c, normal_img=lion_n, normal_strength=0.65, rough_img=lion_r
    )
    mats["r2_bronze_patina"] = _make_pbr("r2_bronze_patina", (0.19, 0.20, 0.17, 1.0), roughness=0.38, metallic=0.82)
    mats["r2_plaque_crimson"] = _make_pbr("r2_plaque_crimson", (0.58, 0.14, 0.10, 1.0), roughness=0.36, coat_weight=0.3)

    # 5. Architectural Glass, Louvers & Observatory Zinc Dome
    mats["r2_glass_window"] = _make_pbr(
        "r2_glass_window", (0.12, 0.25, 0.34, 1.0), roughness=0.07, metallic=0.18, coat_weight=0.85, coat_roughness=0.04, ior=1.52
    )
    mats["r2_glass_turquoise"] = _make_pbr(
        "r2_glass_turquoise", (0.09, 0.40, 0.48, 1.0), roughness=0.06, metallic=0.22, coat_weight=0.90, coat_roughness=0.04, ior=1.52
    )
    mats["r2_glass_bronze"] = _make_pbr(
        "r2_glass_bronze", (0.11, 0.14, 0.15, 1.0), roughness=0.07, metallic=0.25, coat_weight=0.88, coat_roughness=0.04, ior=1.52
    )
    mats["r2_interior_dark"] = _make_pbr("r2_interior_dark", (0.04, 0.05, 0.06, 1.0), roughness=0.92)
    mats["r2_mullion_bronze"] = _make_pbr("r2_mullion_bronze", (0.20, 0.16, 0.13, 1.0), roughness=0.34, metallic=0.72)
    mats["r2_mullion_silver"] = _make_pbr("r2_mullion_silver", (0.76, 0.78, 0.80, 1.0), roughness=0.28, metallic=0.85)
    mats["r2_dome_zinc"] = _make_pbr("r2_dome_zinc", (0.68, 0.70, 0.72, 1.0), roughness=0.32, metallic=0.86, coat_weight=0.2)
    lv_c, lv_n = _gen_keji_louver_tex()
    mats["r2_louver_wood"] = _make_pbr(
        "r2_louver_wood", (0.28, 0.18, 0.11, 1.0), roughness=0.62, albedo_img=lv_c, normal_img=lv_n, normal_strength=1.1
    )

    # 6. Ground, Paving, Track & Botanicals
    mats["r2_ground_lawn"] = _make_pbr(
        "r2_ground_lawn", (0.24, 0.40, 0.17, 1.0), roughness=0.88,
        albedo_img=w_grass_c, normal_img=w_grass_n, normal_strength=0.6, rough_img=w_grass_r,
        tint_mul=(0.76, 0.88, 0.68, 1.0), uv_scale=(1.0, 1.0)
    )
    mats["r2_ground_asphalt"] = _make_pbr("r2_ground_asphalt", (0.22, 0.23, 0.24, 1.0), roughness=0.84, normal_img=w_pave_n, normal_strength=0.35)
    mats["r2_paving_plaza"] = _make_pbr(
        "r2_paving_plaza", (0.75, 0.74, 0.70, 1.0), roughness=0.64,
        albedo_img=w_pave_c, normal_img=w_pave_n, normal_strength=0.65, rough_img=w_pave_r,
        tint_mul=(0.92, 0.90, 0.86, 1.0)
    )
    sg_c, sg_n = _gen_stagger_plaza()
    mats["r2_paving_stagger"] = _make_pbr("r2_paving_stagger", (0.36, 0.36, 0.35, 1.0), roughness=0.60, albedo_img=sg_c, normal_img=sg_n, normal_strength=0.8)
    mats["r2_roof_flat"] = _make_pbr("r2_roof_flat", (0.56, 0.57, 0.56, 1.0), roughness=0.84, normal_img=w_plaster_n, normal_strength=0.35)
    mats["r2_track_clay"] = _make_pbr("r2_track_clay", (0.62, 0.25, 0.19, 1.0), roughness=0.78, albedo_img=_gen_track_lane_tex())
    mats["r2_court_bb"] = _make_pbr("r2_court_bb", (0.18, 0.44, 0.36, 1.0), roughness=0.66, albedo_img=_gen_court_tex())
    mats["r2_bark"] = _make_pbr(
        "r2_bark", (0.38, 0.33, 0.28, 1.0), roughness=0.86,
        albedo_img=w_wood_c, normal_img=w_wood_n, normal_strength=0.8, tint_mul=(0.72, 0.68, 0.62, 1.0)
    )
    mats["r2_foliage_leaf"] = _make_pbr(
        "r2_foliage_leaf", (0.20, 0.42, 0.15, 1.0), roughness=0.58,
        albedo_img=w_leaf_c, alpha_clip=(w_leaf_c is not None), double_sided=True, tint_mul=(0.82, 0.94, 0.72, 1.0)
    )
    mats["r2_foliage_palm"] = _make_pbr("r2_foliage_palm", (0.18, 0.38, 0.14, 1.0), roughness=0.54, double_sided=True)
    mats["r2_foliage_hedge"] = _make_pbr("r2_foliage_hedge", (0.15, 0.33, 0.12, 1.0), roughness=0.78)
    mats["r2_flower_pink"] = _make_pbr("r2_flower_pink", (0.78, 0.16, 0.44, 1.0), roughness=0.64)

    return mats


def load_cjk_font() -> bpy.types.VectorFont | None:
    for p in CJK_FONT_CANDIDATES:
        if p.exists():
            return bpy.data.fonts.load(str(p), check_existing=True)
    return None


def add_cjk_text_object(
    name: str,
    text: str,
    size: float,
    extrude: float,
    mat: bpy.types.Material,
    location: tuple[float, float, float],
    rotation_euler: tuple[float, float, float],
    collection: bpy.types.Collection,
    font: bpy.types.VectorFont | None = None,
    align_x: str = "CENTER",
    align_y: str = "CENTER",
) -> bpy.types.Object:
    """Create crisp 3D beveled CJK calligraphy converted cleanly into a glTF-ready mesh."""
    curve = bpy.data.curves.new(name=f"{name}_curve", type="FONT")
    curve.body = text
    curve.size = size
    curve.extrude = extrude
    curve.bevel_depth = min(0.008, extrude * 0.25)
    curve.bevel_resolution = 1
    curve.align_x = align_x
    curve.align_y = align_y
    if font is not None:
        curve.font = font
    obj = bpy.data.objects.new(name, curve)
    obj.location = location
    obj.rotation_euler = rotation_euler
    collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    obj.select_set(False)
    obj.data.materials.append(mat)
    return obj
