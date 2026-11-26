"""
HAIZ World Reconstruction — Unified PBR Material & Procedural Texture Library.

Generates deterministic, tileable, art-directed PBR textures (albedo + roughness + bump)
using pure NumPy + Blender bpy (zero external image-library dependencies) and builds a
single deduplicated material palette shared across all 6 campus districts.

All material names follow a strict semantic prefix convention (`mat_*`) so the
Three.js runtime can seamlessly attach unified weather wetness, rain ripples,
evening classroom lighting, wind displacement, and multi-lens shaders.
"""
from __future__ import annotations

import math
from pathlib import Path
import numpy as np
import bpy


def _value_noise(h: int, w: int, scale_y: int, scale_x: int, seed: int) -> np.ndarray:
    """Periodic bilinear value noise in [0, 1] for seamless tileable textures."""
    rng = np.random.default_rng(seed)
    grid = rng.random((scale_y, scale_x), dtype=np.float32)
    yy = np.linspace(0, scale_y, h, endpoint=False, dtype=np.float32)
    xx = np.linspace(0, scale_x, w, endpoint=False, dtype=np.float32)
    yi = np.floor(yy).astype(np.int32)
    xi = np.floor(xx).astype(np.int32)
    yf = yy - yi
    xf = xx - xi
    # Smoothstep
    yf = yf * yf * (3.0 - 2.0 * yf)
    xf = xf * xf * (3.0 - 2.0 * xf)
    y0 = yi % scale_y
    y1 = (yi + 1) % scale_y
    x0 = xi % scale_x
    x1 = (xi + 1) % scale_x
    c00 = grid[np.ix_(y0, x0)]
    c10 = grid[np.ix_(y0, x1)]
    c01 = grid[np.ix_(y1, x0)]
    c11 = grid[np.ix_(y1, x1)]
    top = c00 * (1.0 - xf[None, :]) + c10 * xf[None, :]
    bot = c01 * (1.0 - xf[None, :]) + c11 * xf[None, :]
    return top * (1.0 - yf[:, None]) + bot * yf[:, None]


def _fbm(h: int, w: int, octaves: list[tuple[int, int, float]], seed: int) -> np.ndarray:
    acc = np.zeros((h, w), dtype=np.float32)
    norm = 0.0
    for idx, (sy, sx, amp) in enumerate(octaves):
        acc += _value_noise(h, w, sy, sx, seed + idx * 97) * amp
        norm += amp
    return acc / max(norm, 1e-6)


def _height_to_normal(height: np.ndarray, strength: float = 2.0) -> np.ndarray:
    """Convert periodic scalar height field [0, 1] into tangent-space RGB normal map [0, 1]."""
    gx = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * 0.5 * strength
    gy = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * 0.5 * strength
    nx = -gx
    ny = -gy
    nz = np.ones_like(height)
    inv = 1.0 / np.sqrt(nx * nx + ny * ny + nz * nz + 1e-8)
    rgb = np.stack([nx * inv * 0.5 + 0.5, ny * inv * 0.5 + 0.5, nz * inv * 0.5 + 0.5], axis=-1)
    return np.clip(rgb, 0.0, 1.0)


def _create_image(name: str, rgb_or_rgba: np.ndarray, colorspace: str = "sRGB") -> bpy.types.Image:
    """Create a packed Blender Image from a HxWx3 or HxWx4 float32 array in [0, 1]."""
    if name in bpy.data.images:
        bpy.data.images.remove(bpy.data.images[name])
    h, w = rgb_or_rgba.shape[:2]
    if rgb_or_rgba.shape[2] == 3:
        rgba = np.concatenate([rgb_or_rgba, np.ones((h, w, 1), dtype=np.float32)], axis=-1)
    else:
        rgba = rgb_or_rgba.astype(np.float32)
    img = bpy.data.images.new(name=name, width=w, height=h, alpha=(rgb_or_rgba.shape[2] == 4))
    img.colorspace_settings.name = colorspace
    # Blender expects bottom-up flat RGBA
    img.pixels.foreach_set(np.flipud(rgba).ravel())
    img.pack()
    return img


def _make_pbr_mat(
    name: str,
    base_color=(0.8, 0.8, 0.8, 1.0),
    roughness: float = 0.65,
    metallic: float = 0.0,
    albedo_img: bpy.types.Image | None = None,
    normal_img: bpy.types.Image | None = None,
    normal_strength: float = 0.8,
    rough_img: bpy.types.Image | None = None,
    uv_scale: tuple[float, float] = (1.0, 1.0),
    double_sided: bool = False,
    alpha_clip: bool = False,
    alpha_blend: bool = False,
    emission_color=None,
    emission_strength: float = 0.0,
    coat_weight: float = 0.0,
) -> bpy.types.Material:
    if name in bpy.data.materials:
        bpy.data.materials.remove(bpy.data.materials[name])
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    mat.use_backface_culling = not double_sided
    nt = mat.node_tree
    nodes = nt.nodes
    links = nt.links
    bsdf = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = base_color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if "Coat Weight" in bsdf.inputs and coat_weight > 0:
        bsdf.inputs["Coat Weight"].default_value = coat_weight
        bsdf.inputs["Coat Roughness"].default_value = 0.14
    if emission_color is not None and "Emission Color" in bsdf.inputs:
        bsdf.inputs["Emission Color"].default_value = emission_color
        bsdf.inputs["Emission Strength"].default_value = emission_strength

    # Keep viewport color synced for easy editing inside Blender GUI
    mat.diffuse_color = base_color

    tex_coord = None
    mapping = None
    if albedo_img or normal_img or rough_img:
        tex_coord = nodes.new("ShaderNodeTexCoord")
        mapping = nodes.new("ShaderNodeMapping")
        mapping.inputs["Scale"].default_value = (uv_scale[0], uv_scale[1], 1.0)
        links.new(tex_coord.outputs["UV"], mapping.inputs["Vector"])

    if albedo_img:
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = albedo_img
        links.new(mapping.outputs["Vector"], tex.inputs["Vector"])
        links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        if alpha_clip or alpha_blend:
            links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])

    if rough_img:
        rtex = nodes.new("ShaderNodeTexImage")
        rtex.image = rough_img
        links.new(mapping.outputs["Vector"], rtex.inputs["Vector"])
        links.new(rtex.outputs["Color"], bsdf.inputs["Roughness"])

    if normal_img:
        ntex = nodes.new("ShaderNodeTexImage")
        ntex.image = normal_img
        nmap = nodes.new("ShaderNodeNormalMap")
        nmap.inputs["Strength"].default_value = normal_strength
        links.new(mapping.outputs["Vector"], ntex.inputs["Vector"])
        links.new(ntex.outputs["Color"], nmap.inputs["Color"])
        links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])

    if alpha_clip:
        if hasattr(mat, "blend_method"):
            mat.blend_method = "CLIP"
    elif alpha_blend:
        if hasattr(mat, "blend_method"):
            mat.blend_method = "BLEND"

    return mat


def _gen_tile_textures(name: str, base_rgb, dark_rgb, seed: int, size: int = 256):
    """Glazed Lingnan barrel ceramic tile ribs + subtle horizontal course laps."""
    y = np.linspace(0, 1, size, endpoint=False, dtype=np.float32)[:, None]
    x = np.linspace(0, 1, size, endpoint=False, dtype=np.float32)[None, :]
    cols = 12
    rows = 8
    # Barrel flute profile across X
    flute = 0.5 + 0.5 * np.cos(x * cols * 2.0 * math.pi)
    flute = np.power(np.clip(flute, 0.0, 1.0), 0.72)
    # Course overlap sawtooth along Y
    lap = (y * rows) % 1.0
    lap_step = np.clip((lap - 0.06) / 0.12, 0.0, 1.0)
    # Per-tile kiln variation
    tx = np.floor(x * cols).astype(np.int32)
    ty = np.floor(y * rows).astype(np.int32)
    rng = np.random.default_rng(seed)
    kiln = rng.uniform(-0.07, 0.07, (rows, cols)).astype(np.float32)[ty, tx]
    fine = _fbm(size, size, [(8, 8, 0.6), (24, 24, 0.4)], seed + 19)

    height = np.clip(flute * 0.72 + lap * 0.22 + fine * 0.06, 0.0, 1.0)
    shade = np.clip(0.32 + 0.68 * flute * (0.78 + 0.22 * lap_step) + kiln, 0.0, 1.15)
    base = np.array(base_rgb, dtype=np.float32)
    dark = np.array(dark_rgb, dtype=np.float32)
    rgb = dark[None, None, :] * (1.0 - shade[:, :, None] * 0.78) + base[None, None, :] * (shade[:, :, None] * 0.85)
    rgb = np.clip(rgb * (0.94 + 0.12 * fine[:, :, None]), 0.0, 1.0)

    rough = np.clip(0.24 + (1.0 - flute) * 0.26 + fine * 0.08, 0.14, 0.62)
    rough_rgb = np.repeat(rough[:, :, None], 3, axis=-1)
    nrm = _height_to_normal(height, strength=3.4)
    return (
        _create_image(f"tex_{name}_col", rgb, "sRGB"),
        _create_image(f"tex_{name}_nrm", nrm, "Non-Color"),
        _create_image(f"tex_{name}_rgh", rough_rgb, "Non-Color"),
    )


def _gen_granite_blocks(name: str, base_rgb, mortar_rgb, cols: int, rows: int, seed: int, size: int = 256):
    """Ashlar granite masonry cladding (Qiongbei dark granite or red granite steps)."""
    y = np.linspace(0, 1, size, endpoint=False, dtype=np.float32)[:, None]
    x = np.linspace(0, 1, size, endpoint=False, dtype=np.float32)[None, :]
    row_id = np.floor(y * rows).astype(np.int32)
    x_shift = (x + (row_id % 2) * (0.5 / cols)) % 1.0
    col_id = np.floor(x_shift * cols).astype(np.int32)
    fx = (x_shift * cols) % 1.0
    fy = (y * rows) % 1.0

    joint_x = np.minimum(fx, 1.0 - fx)
    joint_y = np.minimum(fy, 1.0 - fy)
    mortar = np.maximum((joint_x < 0.025).astype(np.float32), (joint_y < 0.035).astype(np.float32))

    rng = np.random.default_rng(seed)
    block_var = rng.uniform(-0.08, 0.08, (rows, cols)).astype(np.float32)[row_id, col_id]
    speckle = _fbm(size, size, [(8, 8, 0.4), (32, 32, 0.35), (64, 64, 0.25)], seed + 7)
    base = np.array(base_rgb, dtype=np.float32)
    mcol = np.array(mortar_rgb, dtype=np.float32)
    stone = base[None, None, :] * (0.86 + 0.26 * speckle[:, :, None] + block_var[:, :, None])
    rgb = stone * (1.0 - mortar[:, :, None]) + mcol[None, None, :] * mortar[:, :, None]
    rgb = np.clip(rgb, 0.0, 1.0)

    height = np.clip((1.0 - mortar) * (0.65 + 0.35 * speckle), 0.0, 1.0)
    rough = np.clip(0.50 + 0.22 * (1.0 - speckle) + 0.24 * mortar, 0.32, 0.92)
    return (
        _create_image(f"tex_{name}_col", rgb, "sRGB"),
        _create_image(f"tex_{name}_nrm", _height_to_normal(height, 2.2), "Non-Color"),
        _create_image(f"tex_{name}_rgh", np.repeat(rough[:, :, None], 3, axis=-1), "Non-Color"),
    )


def _gen_paving_diamond(size: int = 256):
    """Authentic Teaching Block 1 central plaza diamond-dot light granite paving (aerial_campus.jpg)."""
    y = np.linspace(0, 1, size, endpoint=False, dtype=np.float32)[:, None]
    x = np.linspace(0, 1, size, endpoint=False, dtype=np.float32)[None, :]
    n = 6
    fx = (x * n) % 1.0
    fy = (y * n) % 1.0
    dx = np.abs(fx - 0.5)
    dy = np.abs(fy - 0.5)
    # Dark diamond accent at tile corners
    corner_dist = np.minimum(fx, 1.0 - fx) + np.minimum(fy, 1.0 - fy)
    dot = (corner_dist < 0.20).astype(np.float32)
    joint = ((np.minimum(fx, 1.0 - fx) < 0.025) | (np.minimum(fy, 1.0 - fy) < 0.025)).astype(np.float32)
    grain = _fbm(size, size, [(12, 12, 0.5), (48, 48, 0.5)], 311)

    light = np.array([0.82, 0.80, 0.76], dtype=np.float32)
    dark = np.array([0.36, 0.38, 0.39], dtype=np.float32)
    rgb = light[None, None, :] * (1.0 - dot[:, :, None]) + dark[None, None, :] * dot[:, :, None]
    rgb *= 0.91 + 0.15 * grain[:, :, None]
    rgb *= 1.0 - 0.22 * joint[:, :, None]
    rgb = np.clip(rgb, 0.0, 1.0)
    height = np.clip(0.8 - 0.55 * joint + 0.16 * grain, 0.0, 1.0)
    rough = np.clip(0.56 + 0.18 * (1.0 - grain) + 0.15 * joint, 0.4, 0.9)
    return (
        _create_image("tex_plaza_diamond_col", rgb, "sRGB"),
        _create_image("tex_plaza_diamond_nrm", _height_to_normal(height, 1.8), "Non-Color"),
        _create_image("tex_plaza_diamond_rgh", np.repeat(rough[:, :, None], 3, axis=-1), "Non-Color"),
    )


def _gen_paving_stagger(size: int = 256):
    """Authentic side-plaza dark granite paving with staggered pale granite squares (scenery_13 / lanshu-1600)."""
    y = np.linspace(0, 1, size, endpoint=False, dtype=np.float32)[:, None]
    x = np.linspace(0, 1, size, endpoint=False, dtype=np.float32)[None, :]
    n = 6
    ix = np.floor(x * n).astype(np.int32)
    iy = np.floor(y * n).astype(np.int32)
    fx = (x * n) % 1.0
    fy = (y * n) % 1.0
    is_light = (((ix % 2 == 0) & (iy % 2 == 0)) | ((ix % 2 == 1) & (iy % 2 == 1) & (ix % 4 == 1))).astype(np.float32)
    joint = ((np.minimum(fx, 1.0 - fx) < 0.03) | (np.minimum(fy, 1.0 - fy) < 0.03)).astype(np.float32)
    grain = _fbm(size, size, [(10, 10, 0.5), (40, 40, 0.5)], 409)

    dark = np.array([0.38, 0.37, 0.35], dtype=np.float32)
    light = np.array([0.74, 0.72, 0.67], dtype=np.float32)
    rgb = dark[None, None, :] * (1.0 - is_light[:, :, None]) + light[None, None, :] * is_light[:, :, None]
    rgb *= 0.89 + 0.18 * grain[:, :, None]
    rgb *= 1.0 - 0.25 * joint[:, :, None]
    rgb = np.clip(rgb, 0.0, 1.0)
    height = np.clip(0.8 - 0.5 * joint + 0.18 * grain, 0.0, 1.0)
    rough = np.clip(0.62 + 0.15 * (1.0 - grain), 0.45, 0.9)
    return (
        _create_image("tex_plaza_stagger_col", rgb, "sRGB"),
        _create_image("tex_plaza_stagger_nrm", _height_to_normal(height, 1.8), "Non-Color"),
        _create_image("tex_plaza_stagger_rgh", np.repeat(rough[:, :, None], 3, axis=-1), "Non-Color"),
    )


def _gen_stucco(name: str, base_rgb, seed: int, size: int = 256, tile_grid: int = 0):
    """Sun-washed tropical stucco plaster or southern Chinese ceramic facade tiles."""
    broad = _fbm(size, size, [(4, 4, 0.45), (12, 12, 0.35), (36, 36, 0.2)], seed)
    streak = _fbm(size, size, [(3, 18, 0.6), (6, 36, 0.4)], seed + 55)
    base = np.array(base_rgb, dtype=np.float32)
    rgb = base[None, None, :] * (0.92 + 0.12 * broad[:, :, None] - 0.05 * streak[:, :, None])
    height = 0.55 + 0.35 * broad
    if tile_grid > 0:
        y = np.linspace(0, 1, size, endpoint=False, dtype=np.float32)[:, None]
        x = np.linspace(0, 1, size, endpoint=False, dtype=np.float32)[None, :]
        fx = (x * tile_grid) % 1.0
        fy = (y * tile_grid * 2) % 1.0
        joint = ((np.minimum(fx, 1.0 - fx) < 0.05) | (np.minimum(fy, 1.0 - fy) < 0.07)).astype(np.float32)
        rgb *= 1.0 - 0.11 * joint[:, :, None]
        height -= 0.25 * joint
    rgb = np.clip(rgb, 0.0, 1.0)
    return (
        _create_image(f"tex_{name}_col", rgb, "sRGB"),
        _create_image(f"tex_{name}_nrm", _height_to_normal(np.clip(height, 0.0, 1.0), 1.3), "Non-Color"),
    )


def _gen_organic_tex(name: str, c1, c2, octaves, seed: int, size: int = 256, nrm_strength: float = 2.6):
    n = _fbm(size, size, octaves, seed)
    rgb = np.array(c1, dtype=np.float32)[None, None, :] * (1.0 - n[:, :, None]) + np.array(c2, dtype=np.float32)[None, None, :] * n[:, :, None]
    rgb = np.clip(rgb, 0.0, 1.0)
    return (
        _create_image(f"tex_{name}_col", rgb, "sRGB"),
        _create_image(f"tex_{name}_nrm", _height_to_normal(n, nrm_strength), "Non-Color"),
    )


def _gen_paifang_plaque_tex(size_w: int = 512, size_h: int = 160) -> bpy.types.Image:
    """Crisp cream-and-gold architectural plaque with emerald fretwork border for 北门「海南中學」."""
    y = np.linspace(0, 1, size_h, dtype=np.float32)[:, None]
    x = np.linspace(0, 1, size_w, dtype=np.float32)[None, :]
    cream = np.array([0.93, 0.90, 0.81], dtype=np.float32)
    jade = np.array([0.11, 0.36, 0.26], dtype=np.float32)
    ochre = np.array([0.75, 0.56, 0.22], dtype=np.float32)
    gold = np.array([0.88, 0.72, 0.31], dtype=np.float32)
    rgb = np.broadcast_to(cream, (size_h, size_w, 3)).copy()

    # Outer ochre + emerald border frames
    border_outer = (x < 0.025) | (x > 0.975) | (y < 0.07) | (y > 0.93)
    border_inner = ((x > 0.035) & (x < 0.965) & (y > 0.11) & (y < 0.89)) & ~((x > 0.048) & (x < 0.952) & (y > 0.16) & (y < 0.84))
    rgb[border_outer] = ochre
    rgb[border_inner] = jade

    # Stylized bold calligraphic gold stroke glyphs (學 中 南 海 right-to-left architectural emblem strokes)
    def rect(x0, y0, x1, y1, col=gold):
        m = (x >= x0) & (x <= x1) & (y >= y0) & (y <= y1)
        rgb[m] = col

    # Four balanced calligraphic character blocks centered across the plaque
    centers = [0.22, 0.41, 0.60, 0.79]
    # 學 (leftmost)
    cx = centers[0]
    rect(cx - 0.048, 0.26, cx + 0.048, 0.33)
    rect(cx - 0.052, 0.36, cx + 0.052, 0.43)
    rect(cx - 0.045, 0.43, cx - 0.030, 0.53)
    rect(cx + 0.030, 0.43, cx + 0.045, 0.53)
    rect(cx - 0.028, 0.49, cx + 0.028, 0.56)
    rect(cx - 0.008, 0.54, cx + 0.008, 0.76)
    rect(cx - 0.048, 0.61, cx + 0.048, 0.68)
    # 中
    cx = centers[1]
    rect(cx - 0.044, 0.36, cx + 0.044, 0.43)
    rect(cx - 0.044, 0.56, cx + 0.044, 0.63)
    rect(cx - 0.044, 0.36, cx - 0.029, 0.63)
    rect(cx + 0.029, 0.36, cx + 0.044, 0.63)
    rect(cx - 0.009, 0.24, cx + 0.009, 0.78)
    # 南
    cx = centers[2]
    rect(cx - 0.048, 0.29, cx + 0.048, 0.36)
    rect(cx - 0.009, 0.22, cx + 0.009, 0.74)
    rect(cx - 0.046, 0.42, cx + 0.046, 0.49)
    rect(cx - 0.046, 0.42, cx - 0.031, 0.76)
    rect(cx + 0.031, 0.42, cx + 0.046, 0.76)
    rect(cx - 0.026, 0.56, cx + 0.026, 0.63)
    # 海 (rightmost)
    cx = centers[3]
    rect(cx - 0.052, 0.30, cx - 0.036, 0.38)
    rect(cx - 0.052, 0.46, cx - 0.036, 0.54)
    rect(cx - 0.052, 0.62, cx - 0.036, 0.74)
    rect(cx - 0.020, 0.26, cx + 0.048, 0.33)
    rect(cx - 0.024, 0.40, cx + 0.046, 0.47)
    rect(cx - 0.024, 0.40, cx - 0.010, 0.73)
    rect(cx + 0.032, 0.40, cx + 0.046, 0.73)
    rect(cx - 0.030, 0.54, cx + 0.052, 0.61)
    rect(cx - 0.022, 0.68, cx + 0.044, 0.75)

    grain = _fbm(size_h, size_w, [(8, 24, 0.6), (20, 60, 0.4)], 901)
    rgb = np.clip(rgb * (0.94 + 0.10 * grain[:, :, None]), 0.0, 1.0)
    return _create_image("tex_north_gate_plaque", rgb, "sRGB")


def _gen_yanchi_stele_tex(size_w: int = 256, size_h: int = 384) -> bpy.types.Image:
    """Weathered limestone stele texture with vibrant vermilion '硯池' vertical inscription."""
    y = np.linspace(0, 1, size_h, dtype=np.float32)[:, None]
    x = np.linspace(0, 1, size_w, dtype=np.float32)[None, :]
    rock = _fbm(size_h, size_w, [(6, 4, 0.45), (18, 12, 0.35), (48, 32, 0.2)], 719)
    c1 = np.array([0.44, 0.45, 0.41], dtype=np.float32)
    c2 = np.array([0.66, 0.64, 0.57], dtype=np.float32)
    rgb = c1[None, None, :] * (1.0 - rock[:, :, None]) + c2[None, None, :] * rock[:, :, None]

    vermilion = np.array([0.78, 0.14, 0.08], dtype=np.float32)

    def stroke(x0, y0, x1, y1, r=0.028):
        dx = x1 - x0
        dy = y1 - y0
        l2 = dx * dx + dy * dy + 1e-6
        t = np.clip(((x - x0) * dx + (y - y0) * dy) / l2, 0.0, 1.0)
        d = np.hypot(x - (x0 + t * dx), y - (y0 + t * dy))
        m = d < r * (0.85 + 0.3 * rock)
        rgb[m] = vermilion * (0.88 + 0.2 * rock[m][:, None])

    # Top character: 硯 (calligraphic approximation)
    stroke(0.32, 0.22, 0.50, 0.21, 0.024)
    stroke(0.41, 0.22, 0.31, 0.38, 0.022)
    stroke(0.35, 0.32, 0.47, 0.32, 0.020)
    stroke(0.35, 0.42, 0.47, 0.42, 0.020)
    stroke(0.35, 0.32, 0.35, 0.42, 0.018)
    stroke(0.47, 0.32, 0.47, 0.42, 0.018)
    stroke(0.55, 0.19, 0.70, 0.19, 0.022)
    stroke(0.55, 0.19, 0.55, 0.37, 0.020)
    stroke(0.70, 0.19, 0.70, 0.37, 0.020)
    stroke(0.55, 0.28, 0.70, 0.28, 0.018)
    stroke(0.55, 0.37, 0.70, 0.37, 0.020)
    stroke(0.58, 0.37, 0.51, 0.49, 0.020)
    stroke(0.66, 0.37, 0.74, 0.48, 0.022)

    # Bottom character: 池
    stroke(0.32, 0.57, 0.37, 0.60, 0.022)
    stroke(0.30, 0.65, 0.36, 0.68, 0.022)
    stroke(0.33, 0.79, 0.38, 0.71, 0.022)
    stroke(0.42, 0.66, 0.73, 0.59, 0.024)
    stroke(0.71, 0.59, 0.68, 0.72, 0.022)
    stroke(0.57, 0.54, 0.57, 0.75, 0.022)
    stroke(0.46, 0.58, 0.46, 0.80, 0.022)
    stroke(0.46, 0.80, 0.72, 0.80, 0.024)
    stroke(0.72, 0.80, 0.74, 0.74, 0.020)

    # Small red seal mark
    m_seal = (x > 0.21) & (x < 0.26) & (y > 0.70) & (y < 0.78)
    rgb[m_seal] = vermilion * 0.9

    return _create_image("tex_yanchi_stele_col", np.clip(rgb, 0.0, 1.0), "sRGB")


def _gen_taihu_plinth_tex(size_w: int = 512, size_h: int = 96) -> bpy.types.Image:
    """Dark polished granite inscription band 「虎踞龍盤捷報頻傳」 for the Taihu plinth."""
    y = np.linspace(0, 1, size_h, dtype=np.float32)[:, None]
    x = np.linspace(0, 1, size_w, dtype=np.float32)[None, :]
    grain = _fbm(size_h, size_w, [(8, 24, 0.5), (24, 72, 0.5)], 521)
    stone = np.array([0.22, 0.25, 0.23], dtype=np.float32)
    rgb = stone[None, None, :] * (0.86 + 0.26 * grain[:, :, None])
    # Subtle pale mineral calligraphic glyphs (8 characters across the central raised slab)
    ink = np.array([0.82, 0.80, 0.72], dtype=np.float32)
    rng = np.random.default_rng(1923)
    for i in range(8):
        cx = 0.14 + i * 0.102
        for _ in range(5):
            dx0 = cx + rng.uniform(-0.028, 0.012)
            dx1 = dx0 + rng.uniform(0.012, 0.036)
            dy0 = rng.uniform(0.24, 0.70)
            dy1 = dy0 + rng.uniform(-0.18, 0.22)
            ddx, ddy = dx1 - dx0, dy1 - dy0
            l2 = ddx * ddx + ddy * ddy + 1e-6
            t = np.clip(((x - dx0) * ddx + (y - dy0) * ddy) / l2, 0.0, 1.0)
            d = np.hypot((x - (dx0 + t * ddx)) * 5.0, y - (dy0 + t * ddy))
            m = d < 0.036
            rgb[m] = ink * (0.9 + 0.1 * grain[m][:, None])
    return _create_image("tex_taihu_plinth_col", np.clip(rgb, 0.0, 1.0), "sRGB")


def build_material_library() -> dict[str, bpy.types.Material]:
    """Build and cache the entire unified HAIZ PBR material library."""
    mats: dict[str, bpy.types.Material] = {}

    # 1. Glazed Ceramic Roofs (Signature Hainan Middle School Emerald & Terracotta)
    em_c, em_n, em_r = _gen_tile_textures("emerald_tile", (0.11, 0.52, 0.37), (0.04, 0.22, 0.16), 101)
    mats["mat_roof_emerald"] = _make_pbr_mat(
        "mat_roof_emerald", base_color=(0.11, 0.48, 0.35, 1.0), roughness=0.28,
        albedo_img=em_c, normal_img=em_n, normal_strength=1.1, rough_img=em_r, coat_weight=0.45
    )

    tr_c, tr_n, tr_r = _gen_tile_textures("terracotta_tile", (0.76, 0.23, 0.16), (0.36, 0.09, 0.06), 102)
    mats["mat_roof_terracotta"] = _make_pbr_mat(
        "mat_roof_terracotta", base_color=(0.74, 0.24, 0.17, 1.0), roughness=0.34,
        albedo_img=tr_c, normal_img=tr_n, normal_strength=1.05, rough_img=tr_r, coat_weight=0.28
    )

    # 2. Architectural Masonry & Plasters
    dg_c, dg_n, dg_r = _gen_granite_blocks("granite_dark", (0.24, 0.27, 0.25), (0.14, 0.15, 0.14), 6, 10, 201)
    mats["mat_stone_granite_dark"] = _make_pbr_mat(
        "mat_stone_granite_dark", base_color=(0.24, 0.27, 0.25, 1.0), roughness=0.58,
        albedo_img=dg_c, normal_img=dg_n, normal_strength=0.85, rough_img=dg_r
    )

    rg_c, rg_n, rg_r = _gen_granite_blocks("granite_red", (0.60, 0.33, 0.27), (0.34, 0.19, 0.16), 4, 8, 202)
    mats["mat_stone_granite_red"] = _make_pbr_mat(
        "mat_stone_granite_red", base_color=(0.58, 0.32, 0.26, 1.0), roughness=0.54,
        albedo_img=rg_c, normal_img=rg_n, normal_strength=0.75, rough_img=rg_r
    )

    gg_c, gg_n, gg_r = _gen_granite_blocks("granite_grey", (0.58, 0.57, 0.54), (0.38, 0.37, 0.35), 5, 8, 203)
    mats["mat_stone_granite_grey"] = _make_pbr_mat(
        "mat_stone_granite_grey", base_color=(0.58, 0.57, 0.54, 1.0), roughness=0.62,
        albedo_img=gg_c, normal_img=gg_n, normal_strength=0.7, rough_img=gg_r
    )

    iv_c, iv_n = _gen_stucco("wall_ivory", (0.91, 0.89, 0.84), 301, tile_grid=0)
    mats["mat_wall_ivory"] = _make_pbr_mat(
        "mat_wall_ivory", base_color=(0.91, 0.89, 0.84, 1.0), roughness=0.78,
        albedo_img=iv_c, normal_img=iv_n, normal_strength=0.45
    )

    cr_c, cr_n = _gen_stucco("wall_coral", (0.76, 0.52, 0.45), 302, tile_grid=0)
    mats["mat_wall_coral"] = _make_pbr_mat(
        "mat_wall_coral", base_color=(0.76, 0.52, 0.45, 1.0), roughness=0.76,
        albedo_img=cr_c, normal_img=cr_n, normal_strength=0.45
    )

    pt_c, pt_n = _gen_stucco("wall_pale_tile", (0.84, 0.81, 0.74), 303, tile_grid=16)
    mats["mat_wall_pale_tile"] = _make_pbr_mat(
        "mat_wall_pale_tile", base_color=(0.84, 0.81, 0.74, 1.0), roughness=0.64,
        albedo_img=pt_c, normal_img=pt_n, normal_strength=0.55
    )

    sand_c, sand_n = _gen_stucco("wall_warm_sand", (0.76, 0.69, 0.58), 304, tile_grid=0)
    mats["mat_wall_warm_sand"] = _make_pbr_mat(
        "mat_wall_warm_sand", base_color=(0.76, 0.69, 0.58, 1.0), roughness=0.72,
        albedo_img=sand_c, normal_img=sand_n, normal_strength=0.42
    )

    # 3. Trims, Accents, Metals & Glass
    mats["mat_trim_white"] = _make_pbr_mat("mat_trim_white", (0.95, 0.94, 0.91, 1.0), roughness=0.55)
    mats["mat_trim_ochre"] = _make_pbr_mat("mat_trim_ochre", (0.78, 0.55, 0.19, 1.0), roughness=0.42, metallic=0.15)
    mats["mat_trim_jade"] = _make_pbr_mat("mat_trim_jade", (0.11, 0.39, 0.28, 1.0), roughness=0.38)
    mats["mat_paint_vermilion"] = _make_pbr_mat("mat_paint_vermilion", (0.58, 0.14, 0.10, 1.0), roughness=0.36, coat_weight=0.25)
    mats["mat_paint_gold"] = _make_pbr_mat("mat_paint_gold", (0.86, 0.68, 0.25, 1.0), roughness=0.28, metallic=0.78)
    mats["mat_metal_dark"] = _make_pbr_mat("mat_metal_dark", (0.18, 0.20, 0.21, 1.0), roughness=0.42, metallic=0.65)
    mats["mat_metal_silver"] = _make_pbr_mat("mat_metal_silver", (0.76, 0.79, 0.82, 1.0), roughness=0.24, metallic=0.86)
    mats["mat_bronze_statue"] = _make_pbr_mat("mat_bronze_statue", (0.24, 0.23, 0.18, 1.0), roughness=0.38, metallic=0.76)
    mats["mat_roof_flat"] = _make_pbr_mat("mat_roof_flat", (0.52, 0.54, 0.53, 1.0), roughness=0.84)
    mats["mat_glass_classroom"] = _make_pbr_mat("mat_glass_classroom", (0.13, 0.22, 0.28, 1.0), roughness=0.09, metallic=0.18, coat_weight=0.5)
    mats["mat_glass_turquoise"] = _make_pbr_mat("mat_glass_turquoise", (0.10, 0.44, 0.54, 1.0), roughness=0.08, metallic=0.22, coat_weight=0.6)
    mats["mat_lamp_globe"] = _make_pbr_mat(
        "mat_lamp_globe", (0.98, 0.95, 0.86, 1.0), roughness=0.22,
        emission_color=(1.0, 0.86, 0.58, 1.0), emission_strength=0.4
    )
    mats["mat_sign_blue"] = _make_pbr_mat("mat_sign_blue", (0.18, 0.44, 0.76, 1.0), roughness=0.35)
    mats["mat_wood_warm"] = _make_pbr_mat("mat_wood_warm", (0.48, 0.30, 0.18, 1.0), roughness=0.62)

    # 4. Ground, Paving & Sports Surfaces
    pd_c, pd_n, pd_r = _gen_paving_diamond()
    mats["mat_paving_plaza_diamond"] = _make_pbr_mat(
        "mat_paving_plaza_diamond", (0.78, 0.76, 0.72, 1.0), roughness=0.58,
        albedo_img=pd_c, normal_img=pd_n, normal_strength=0.65, rough_img=pd_r
    )
    ps_c, ps_n, ps_r = _gen_paving_stagger()
    mats["mat_paving_side_stagger"] = _make_pbr_mat(
        "mat_paving_side_stagger", (0.45, 0.44, 0.42, 1.0), roughness=0.62,
        albedo_img=ps_c, normal_img=ps_n, normal_strength=0.65, rough_img=ps_r
    )
    asp_c, asp_n = _gen_organic_tex("asphalt", (0.25, 0.26, 0.27), (0.35, 0.35, 0.34), [(12, 12, 0.4), (48, 48, 0.6)], 401, nrm_strength=1.2)
    mats["mat_paving_asphalt"] = _make_pbr_mat(
        "mat_paving_asphalt", (0.30, 0.31, 0.31, 1.0), roughness=0.78,
        albedo_img=asp_c, normal_img=asp_n, normal_strength=0.5
    )
    lwn_c, lwn_n = _gen_organic_tex("lawn", (0.22, 0.42, 0.16), (0.39, 0.56, 0.24), [(6, 6, 0.45), (20, 20, 0.35), (56, 56, 0.2)], 402, nrm_strength=1.1)
    mats["mat_ground_lawn"] = _make_pbr_mat(
        "mat_ground_lawn", (0.30, 0.49, 0.20, 1.0), roughness=0.88,
        albedo_img=lwn_c, normal_img=lwn_n, normal_strength=0.45
    )
    mats["mat_ground_concrete"] = _make_pbr_mat("mat_ground_concrete", (0.72, 0.70, 0.65, 1.0), roughness=0.76)
    mats["mat_track_red"] = _make_pbr_mat("mat_track_red", (0.64, 0.27, 0.21, 1.0), roughness=0.78)
    mats["mat_court_green"] = _make_pbr_mat("mat_court_green", (0.17, 0.44, 0.31, 1.0), roughness=0.72)
    mats["mat_court_red"] = _make_pbr_mat("mat_court_red", (0.66, 0.28, 0.23, 1.0), roughness=0.72)
    mats["mat_line_white"] = _make_pbr_mat("mat_line_white", (0.94, 0.94, 0.91, 1.0), roughness=0.70)

    # 5. Natural Stone, Bark, Foliage & Water
    th_c, th_n = _gen_organic_tex("taihu_rock", (0.28, 0.30, 0.29), (0.56, 0.52, 0.43), [(5, 5, 0.45), (16, 16, 0.35), (42, 42, 0.2)], 501, nrm_strength=3.0)
    mats["mat_stone_taihu"] = _make_pbr_mat(
        "mat_stone_taihu", (0.42, 0.42, 0.39, 1.0), roughness=0.74,
        albedo_img=th_c, normal_img=th_n, normal_strength=1.2
    )
    mats["mat_stone_lion"] = _make_pbr_mat("mat_stone_lion", (0.86, 0.84, 0.78, 1.0), roughness=0.62)

    bk_c, bk_n = _gen_organic_tex("bark", (0.22, 0.17, 0.14), (0.40, 0.33, 0.26), [(6, 20, 0.5), (16, 48, 0.5)], 502, nrm_strength=2.8)
    mats["mat_bark_tropical"] = _make_pbr_mat(
        "mat_bark_tropical", (0.31, 0.25, 0.20, 1.0), roughness=0.88,
        albedo_img=bk_c, normal_img=bk_n, normal_strength=1.1
    )
    mats["mat_bark_palm"] = _make_pbr_mat("mat_bark_palm", (0.54, 0.51, 0.46, 1.0), roughness=0.82)
    mats["mat_bark_whitewash"] = _make_pbr_mat("mat_bark_whitewash", (0.88, 0.88, 0.84, 1.0), roughness=0.90)
    mats["mat_palm_crownshaft"] = _make_pbr_mat("mat_palm_crownshaft", (0.24, 0.46, 0.18, 1.0), roughness=0.62)

    mats["mat_foliage_terminalia"] = _make_pbr_mat("mat_foliage_terminalia", (0.21, 0.44, 0.15, 1.0), roughness=0.58, double_sided=True)
    mats["mat_foliage_terminalia_autumn"] = _make_pbr_mat("mat_foliage_terminalia_autumn", (0.64, 0.22, 0.11, 1.0), roughness=0.56, double_sided=True)
    mats["mat_foliage_palm"] = _make_pbr_mat("mat_foliage_palm", (0.26, 0.48, 0.16, 1.0), roughness=0.54, double_sided=True)
    mats["mat_foliage_banyan"] = _make_pbr_mat("mat_foliage_banyan", (0.16, 0.36, 0.14, 1.0), roughness=0.62, double_sided=True)
    mats["mat_foliage_frangipani"] = _make_pbr_mat("mat_foliage_frangipani", (0.27, 0.50, 0.19, 1.0), roughness=0.56, double_sided=True)
    mats["mat_flower_frangipani"] = _make_pbr_mat("mat_flower_frangipani", (0.98, 0.96, 0.82, 1.0), roughness=0.52, double_sided=True)
    mats["mat_flower_bougainvillea"] = _make_pbr_mat("mat_flower_bougainvillea", (0.78, 0.12, 0.38, 1.0), roughness=0.54, double_sided=True)
    mats["mat_hedge"] = _make_pbr_mat("mat_hedge", (0.18, 0.39, 0.15, 1.0), roughness=0.76)

    mats["mat_water_yanchi"] = _make_pbr_mat(
        "mat_water_yanchi", (0.05, 0.20, 0.14, 0.92), roughness=0.07, metallic=0.08, alpha_blend=True, coat_weight=0.75
    )
    mats["mat_water_foam"] = _make_pbr_mat(
        "mat_water_foam", (0.84, 0.91, 0.90, 0.78), roughness=0.22, alpha_blend=True
    )

    # 6. Dedicated Calibrated Landmark Inscription Textures
    mats["mat_north_gate_plaque"] = _make_pbr_mat(
        "mat_north_gate_plaque", (0.93, 0.90, 0.81, 1.0), roughness=0.40,
        albedo_img=_gen_paifang_plaque_tex()
    )
    mats["mat_yanchi_stele"] = _make_pbr_mat(
        "mat_yanchi_stele", (0.58, 0.56, 0.50, 1.0), roughness=0.74,
        albedo_img=_gen_yanchi_stele_tex(), normal_img=th_n, normal_strength=0.9
    )
    mats["mat_taihu_plinth_panel"] = _make_pbr_mat(
        "mat_taihu_plinth_panel", (0.24, 0.27, 0.25, 1.0), roughness=0.45,
        albedo_img=_gen_taihu_plinth_tex()
    )

    # 7. Fucheng Context City Palettes (5 realistic Haikou southern urban tones)
    ctx_colors = [
        ("mat_ctx_cream", (0.86, 0.82, 0.74, 1.0)),
        ("mat_ctx_ochre", (0.82, 0.68, 0.49, 1.0)),
        ("mat_ctx_rose", (0.79, 0.67, 0.60, 1.0)),
        ("mat_ctx_sage", (0.76, 0.79, 0.75, 1.0)),
        ("mat_ctx_stone", (0.78, 0.77, 0.73, 1.0)),
    ]
    for cname, col in ctx_colors:
        mats[cname] = _make_pbr_mat(cname, col, roughness=0.80)

    return mats
