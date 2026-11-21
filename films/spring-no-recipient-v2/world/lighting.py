"""Lighting states shared by the Cycles bakes and the Three.js renderer.

Sun azimuth is measured clockwise from north (+Y), elevation above the horizon.
`sun_dir` is the unit vector pointing *towards* the sun in Blender coordinates.
"""
import json
import math
import pathlib

STATES = {
    # low sun from the west-south-west, straight across the river into the classroom
    "dusk":    dict(az=258.0, el=6.5, sun=3.2, sun_col=(1.0, 0.62, 0.34), sky=1.0, air=1.4, aerosol=2.2, ozone=1.0),
    # a cold, very clear spring morning; the sun is behind the school (east)
    "morning": dict(az=104.0, el=22.0, sun=4.6, sun_col=(1.0, 0.95, 0.88), sky=1.0, air=0.9, aerosol=0.35, ozone=1.0),
    # blue hour before sunrise: no direct sun at all
    "dawn":    dict(az=92.0, el=-3.5, sun=0.0, sun_col=(1.0, 0.7, 0.5), sky=1.0, air=1.0, aerosol=0.8, ozone=1.6),
    # night at the station: lamps only, a little moonlit sky
    "night":   dict(az=200.0, el=-30.0, sun=0.0, sun_col=(0.6, 0.7, 1.0), sky=0.0, air=1.0, aerosol=1.0, ozone=1.0, moon=0.06),
}


def sun_dir(st):
    az, el = math.radians(st["az"]), math.radians(st["el"])
    return (math.cos(el) * math.sin(az), math.cos(el) * math.cos(az), math.sin(el))


def export_json(path):
    out = {k: dict(v, dir=sun_dir(v)) for k, v in STATES.items()}
    pathlib.Path(path).write_text(json.dumps(out, indent=1))


def setup_blender(state, bpy, lamps=False, world_strength=None, sun_strength=None):
    """Create/replace world sky + sun lamp for a state. Returns the sun object (or None)."""
    from mathutils import Vector
    st = STATES[state]
    sc = bpy.context.scene
    w = bpy.data.worlds.get("SKY") or bpy.data.worlds.new("SKY")
    sc.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
    ws = st["sky"] if world_strength is None else world_strength
    if st["sky"] > 0:
        sky = nt.nodes.new("ShaderNodeTexSky")
        sky.sky_type = "MULTIPLE_SCATTERING"
        sky.sun_disc = False
        sky.sun_elevation = math.radians(st["el"])
        # verified with a panorama render: sun_rotation is the compass azimuth (clockwise from +Y)
        sky.sun_rotation = math.radians(st["az"]) % (2 * math.pi)
        sky.air_density = st["air"]
        sky.aerosol_density = st["aerosol"]
        sky.ozone_density = st["ozone"]
        nt.links.new(sky.outputs["Color"], bg.inputs["Color"])
        bg.inputs["Strength"].default_value = ws * 0.12
    else:
        bg.inputs["Color"].default_value = (0.010, 0.016, 0.034, 1)
        bg.inputs["Strength"].default_value = (st.get("moon", 0.05) * 4.0) if world_strength is None else world_strength
    for ob in [o for o in bpy.data.objects if o.name.startswith("SUN")]:
        bpy.data.objects.remove(ob, do_unlink=True)
    sun = None
    s = st["sun"] if sun_strength is None else sun_strength
    if s > 0 and st["el"] > -1:
        ld = bpy.data.lights.new("SUN", "SUN")
        ld.energy = s
        ld.color = st["sun_col"]
        ld.angle = math.radians(0.53)
        sun = bpy.data.objects.new("SUN", ld)
        sc.collection.objects.link(sun)
        d = Vector(sun_dir(st))
        sun.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
    # emissive lamps (station canopy) only at night
    m = bpy.data.materials.get("lampglow")
    if m:
        m.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = 18.0 if lamps else 0.0
    return sun
