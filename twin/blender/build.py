"""Build the HAIZ twin scene with Blender-as-a-module (bpy 5.x), export it, and render views.

    python twin/blender/build.py --only yihao --glb out.glb --blend out.blend \
        --render aerial_n front_eye --samples 64 --res 1600 1000 --renders DIR

Scene frame = twin frame (metres; +x campus east, +y campus north towards the North Gate,
+z up; z = 0 at the forecourt road in front of Teaching Block 1).  The glTF exporter's +Y-up
conversion maps twin (x, y, z) to glTF (x, z, -y), so -Z in three.js points to the North Gate.
"""
from __future__ import annotations
import os, sys, json, math, argparse, time, datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
TWIN = HERE.parent
sys.path[:0] = [str(HERE), str(TWIN / 'py')]

import bpy
from mathutils import Matrix, Vector
import kit

# builders import helpers with `from build import ...`; make that resolve to this module even when
# it runs as __main__ (otherwise Python would load a second copy of it)
sys.modules.setdefault('build', sys.modules[__name__])
CJK_FONT = '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc'

SITE = json.loads((TWIN / 'data/site.json').read_text()) if (TWIN / 'data/site.json').exists() else {}


# ---------------------------------------------------------------------------------------
# scene helpers
# ---------------------------------------------------------------------------------------

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.unit_settings.system = 'METRIC'
    return sc


def collection(name, parent=None):
    c = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    if c.name not in (parent or bpy.context.scene.collection).children:
        (parent or bpy.context.scene.collection).children.link(c)
    return c


def text_mesh(req, name):
    cu = bpy.data.curves.new(name + '.curve', 'FONT')
    if req.get('font') == 'cjk' and Path(CJK_FONT).exists():
        f = bpy.data.fonts.get('cjk') or bpy.data.fonts.load(CJK_FONT)
        f.name = 'cjk'
        cu.font = f
    cu.body = req['text']
    cu.size = req['size']
    cu.extrude = req['extrude']
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    ob = bpy.data.objects.new(name + '.tmp', cu)
    bpy.context.scene.collection.objects.link(ob)
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    bpy.data.objects.remove(ob)
    bpy.data.curves.remove(cu)
    me.name = name
    me.materials.clear()
    me.materials.append(kit.get_material(req['mat']))
    return me


def instantiate(name: str, out, coll, root: Matrix, tag: dict | None = None):
    """Turn a builder Out (parts, window instances, text requests) into Blender objects under
    one root empty.  Window prototypes become shared meshes (linked duplicates)."""
    rootob = bpy.data.objects.new(name, None)
    coll.objects.link(rootob)
    rootob.matrix_world = root
    if tag:
        for k, v in tag.items():
            rootob['haiz_' + k] = v
    n_faces = 0
    for part, g in out.g.items():
        if not g.faces:
            continue
        ob = g.to_object(f'{name}.{part}', coll)
        ob.parent = rootob
        t = out.tags.get(part, {})
        ob['haiz_part'] = part
        ob['haiz_tag'] = t.get('tag', '')
        ob['haiz_basis'] = t.get('basis', '')
        n_faces += len(g.faces)
    meshes = {k: v.to_mesh(f'{name}.win.{k}') for k, v in out.protos.items()}
    def tag_of(part):
        t = out.tags.get(part) or {}
        if t.get('tag'):
            return t['tag'], t.get('basis', '')
        return 'photo-derived/estimated', 'window units and lettering placed on the facade parts; see the tags of those parts'

    wins = bpy.data.objects.new(f'{name}.windows', None)
    coll.objects.link(wins)
    wins.parent = rootob
    wins['haiz_tag'], wins['haiz_basis'] = tag_of('windows')
    for i, (proto, M, part) in enumerate(out.inst):
        ob = bpy.data.objects.new(f'{name}.{part}.{proto}.{i:03d}', meshes[proto])
        coll.objects.link(ob)
        ob.parent = wins
        ob.matrix_basis = M
        ob['haiz_tag'], ob['haiz_basis'] = tag_of(part)
        n_faces += len(out.protos[proto].faces)
    for i, req in enumerate(getattr(out, 'texts', [])):
        me = text_mesh(req, f'{name}.text.{i}')
        ob = bpy.data.objects.new(f'{name}.{req["part"]}.text.{i}', me)
        coll.objects.link(ob)
        ob.parent = rootob
        ob.matrix_basis = req['M']
        ob['haiz_text'] = req['text']
        ob['haiz_tag'], ob['haiz_basis'] = tag_of(req['part'])
    return rootob, n_faces


# ---------------------------------------------------------------------------------------
# sun & sky
# ---------------------------------------------------------------------------------------

def solar_position(lat, lon, when_utc: datetime.datetime):
    """Solar azimuth (deg from north, clockwise) and elevation (deg).  NOAA approximation."""
    jd = (when_utc - datetime.datetime(2000, 1, 1, 12, tzinfo=datetime.timezone.utc)).total_seconds() / 86400.0
    g = math.radians((357.529 + 0.98560028 * jd) % 360)
    q = (280.459 + 0.98564736 * jd) % 360
    L = math.radians((q + 1.915 * math.sin(g) + 0.020 * math.sin(2 * g)) % 360)
    e = math.radians(23.439 - 0.00000036 * jd)
    ra = math.atan2(math.cos(e) * math.sin(L), math.cos(L))
    dec = math.asin(math.sin(e) * math.sin(L))
    gmst = (18.697374558 + 24.06570982441908 * jd) % 24
    lst = math.radians((gmst * 15 + lon) % 360)
    ha = lst - ra
    la = math.radians(lat)
    el = math.asin(math.sin(la) * math.sin(dec) + math.cos(la) * math.cos(dec) * math.cos(ha))
    az = math.atan2(-math.sin(ha), math.tan(dec) * math.cos(la) - math.sin(la) * math.cos(ha))
    return (math.degrees(az) + 360) % 360, math.degrees(el)


def sun_and_sky(sc, when_local: str = '2026-06-21T16:30', tz=8, strength=4.0):
    from haiztwin.geo import TwinFrame
    fr = TwinFrame.load()
    lat, lon = fr.origin_wgs
    t = datetime.datetime.fromisoformat(when_local).replace(tzinfo=datetime.timezone(datetime.timedelta(hours=tz)))
    az, el = solar_position(lat, lon, t.astimezone(datetime.timezone.utc))
    north_bearing = 360.0 - fr.theta_deg           # bearing of twin +y
    b = math.radians(az - north_bearing)
    d = Vector((math.sin(b) * math.cos(math.radians(el)), math.cos(b) * math.cos(math.radians(el)), math.sin(math.radians(el))))
    lamp = bpy.data.lights.new('sun', 'SUN')
    lamp.energy = strength
    lamp.angle = math.radians(0.53)
    ob = bpy.data.objects.new('sun', lamp)
    sc.collection.objects.link(ob)
    ob.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    world = bpy.data.worlds.new('sky')
    sc.world = world
    world.use_nodes = True
    nt = world.node_tree
    bg = nt.nodes.get('Background')
    sky = nt.nodes.new('ShaderNodeTexSky')
    for kind in ('MULTIPLE_SCATTERING', 'NISHITA', 'HOSEK_WILKIE'):
        try:
            sky.sky_type = kind
            break
        except Exception:
            continue
    try:
        sky.sun_elevation = math.radians(el)
        sky.sun_rotation = math.atan2(d.x, d.y) * -1 + math.pi / 2
        sky.sun_disc = False
        sky.altitude = 20.0
    except Exception:
        pass
    nt.links.new(sky.outputs['Color'], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = 0.35
    return dict(azimuth=az, elevation=el, when=when_local, twin_dir=tuple(round(c, 4) for c in d))


# ---------------------------------------------------------------------------------------
# cameras
# ---------------------------------------------------------------------------------------

CAMERAS = {
    # name: (location, look-at, focal length mm on a 36 mm sensor) — twin frame, z = 0 at the forecourt road
    'aerial_n':  ((2.0, 118.0, 92.0), (0.0, -4.0, 8.0), 24.0),
    'front_eye': ((2.0, 47.0, 1.65), (0.0, 0.0, 13.0), 24.0),
    'portal':    ((9.0, 27.0, 1.65), (-1.0, 3.0, 7.0), 28.0),
    'flank_e':   ((56.0, 9.0, 1.65), (5.0, 0.0, 9.0), 24.0),
    'oblique_ne':((95.0, 70.0, 45.0), (5.0, -2.0, 8.0), 35.0),
    'oblique_nw':((-90.0, 75.0, 40.0), (-5.0, -2.0, 8.0), 35.0),
    'top':       ((0.0, 10.0, 260.0), (0.0, 10.0, 0.0), 50.0),
    'lanren_w':  ((19.0, 27.0, 1.65), (42.0, 16.0, 5.5), 16.0),
    # approximate viewpoints of reference photographs; 'lanshu' and 'gate_n' are replaced by their calibrated
    # cameras (CALIBRATED) when the calibration report exists
    'lanshu':    ((49.8, 22.75, 1.27), (31.9, 5.7, 4.6), 26.0),
    'taihushi':  ((0.6, 41.0, 1.7), (0.3, 28.4, 1.9), 30.0),
    'jiaoxuelou':((-5.0, 41.7, 1.78), (0.0, 28.0, 2.5), 30.0),
    'gate_n':    ((0.0, 119.8, 1.52), (0.0, 0.0, 1.52), 36.0 * 2036 / 2560),
    'gate_obl':  ((-14.0, 128.0, 4.5), (0.0, 106.0, 4.5), 30.0),
    'yanchi':    ((28.0, -105.0, 1.75), (50.0, -121.0, 2.5), 22.0),
    'campus_n':  ((40.0, 260.0, 210.0), (10.0, -60.0, 0.0), 30.0),
}
# principal-point offsets (Blender shift_x, shift_y) for cameras matched to cropped photographs
CAMERA_SHIFT = {'gate_n': (0.0, (1075 - 673.5) / 2560)}
# cameras recovered from photographs by twin/tools/calib.py; they replace the approximate entries above
CALIBRATED = {'gate_n': 'evidence/calibration/hero-2560', 'lanshu': 'evidence/calibration/lanshu-1600',
              'jiaoxuelou': 'evidence/calibration/jiaoxuelou-1600'}


def calibrated_camera(sc, name, stem, sensor=36.0):
    """Camera from a calibration report (calib.py or calib_lines.py): position, orientation and focal length fitted
    on the photograph, principal point as Blender shift.  Lens distortion (calib_lines k1) is not rendered."""
    rep = json.loads((TWIN / f'{stem}.report.json').read_text())
    W, H = json.loads((TWIN / f'{stem}.json').read_text())['image_size']
    c = rep['camera']
    if 'basis' in c:                            # calib_lines.py report: explicit camera axes (pitch and roll included)
        right, up, fwd = (Vector(c['basis'][k]) for k in ('right', 'up', 'forward'))
    else:                                       # calib.py report: level camera, yaw and roll only
        yaw, roll = math.radians(c['yaw_deg']), math.radians(c['roll_deg'])
        fwd = Vector((-math.sin(yaw), -math.cos(yaw), 0.0))
        right0 = Vector((-math.cos(yaw), math.sin(yaw), 0.0)); up0 = Vector((0.0, 0.0, 1.0))
        right = right0 * math.cos(roll) + up0 * math.sin(roll)
        up = up0 * math.cos(roll) - right0 * math.sin(roll)
    cam = bpy.data.cameras.new(name)
    cam.sensor_fit = 'HORIZONTAL'
    cam.sensor_width = sensor
    cam.lens = c['f_px'] * sensor / W
    cam.clip_start, cam.clip_end = 0.1, 3000
    px, py = c['principal_point']
    cam.shift_x = -(px - W / 2) / W            # Blender shift is in units of the larger image side
    cam.shift_y = (py - H / 2) / W
    ob = bpy.data.objects.new('cam.' + name, cam)
    sc.collection.objects.link(ob)
    ob.matrix_world = Matrix((
        (right.x, up.x, -fwd.x, c['x']),
        (right.y, up.y, -fwd.y, c['y']),
        (right.z, up.z, -fwd.z, c['z']),
        (0.0, 0.0, 0.0, 1.0)))
    return ob


def add_camera(sc, name, loc, look, lens, sensor=36.0):
    cam = bpy.data.cameras.new(name)
    cam.lens = lens
    cam.sensor_width = sensor
    cam.clip_start = 0.1
    cam.clip_end = 3000
    ob = bpy.data.objects.new('cam.' + name, cam)
    sc.collection.objects.link(ob)
    ob.location = loc
    d = Vector(look) - Vector(loc)
    ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    return ob


def setup_render(sc, samples=64, res=(1600, 1000)):
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = samples
    try:
        sc.cycles.use_denoising = True
    except Exception:
        pass
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = 'JPEG'
    sc.render.image_settings.quality = 88
    try:
        sc.view_settings.view_transform = 'AgX'
        sc.view_settings.look = 'AgX - Medium High Contrast'
    except Exception:
        pass
    sc.render.threads_mode = 'AUTO'


# ---------------------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------------------

def build_scene(only=None):
    stats = {}
    placements = SITE.get('placements', {})
    import b_yihao
    if not only or 'yihao' in only:
        t0 = time.time()
        out = b_yihao.build()
        c = collection('yihao')
        pl = placements.get('yihao', {'xyz': [0.0, 0.0, 1.05], 'rot_deg': 0.0})
        M = Matrix.Translation(pl['xyz']) @ Matrix.Rotation(math.radians(pl.get('rot_deg', 0.0)), 4, 'Z')
        _, nf = instantiate('yihao', out, c, M, {'building': 'yihao', 'name': '一号教学楼'})
        stats['yihao'] = dict(faces=nf, parts=len(out.g), windows=len(out.inst), seconds=round(time.time() - t0, 1))
    for mod_name, key in (('b_site', 'site'), ('b_trees', 'trees'), ('b_gate', 'gate'), ('b_campus', 'campus')):
        if only and key not in only:
            continue
        if not (HERE / f'{mod_name}.py').exists():
            continue
        t0 = time.time()
        mod = __import__(mod_name)
        res = mod.build(collection(key))
        stats[key] = dict(res or {}, seconds=round(time.time() - t0, 1))
    return stats


def export_glb(path, gpu_instances=True):
    kw = dict(filepath=str(path), export_format='GLB', export_yup=True, export_extras=True, export_apply=False,
              export_cameras=False, export_lights=False, export_materials='EXPORT')
    try:
        bpy.ops.export_scene.gltf(export_gpu_instances=gpu_instances, **kw)
    except TypeError:
        bpy.ops.export_scene.gltf(**kw)


def _blender_draco_available():
    try:
        from io_scene_gltf2.io.com.library import dll_path
        return dll_path('bf_intern_draco_bridge', 'Draco').exists()
    except Exception:
        return False


def _gltf_transform():
    """The gltf-transform CLI (npm @gltf-transform/cli), used for Draco when Blender's own encoder is missing
    (the pip 'bpy' wheel ships without libbf_intern_draco_bridge)."""
    import shutil
    exe = os.environ.get('HAIZ_GLTF_TRANSFORM') or shutil.which('gltf-transform')
    return exe if exe and Path(exe).exists() else None


def export_split(outdir, draco=True):
    """One GLB per top-level collection (yihao, site, trees, gate, campus) plus a manifest.
    Meshes are Draco-compressed (KHR_draco_mesh_compression) by Blender when its encoder is present,
    otherwise by gltf-transform when it is installed; node extras (haiz_tag / haiz_basis) survive both."""
    import subprocess
    outdir = Path(outdir); outdir.mkdir(parents=True, exist_ok=True)
    use_blender = draco and _blender_draco_available()
    gt = None if (use_blender or not draco) else _gltf_transform()
    method = ('blender' if use_blender else 'gltf-transform' if gt else 'none')
    manifest = {'frame': 'glTF +Y up; twin (x, y, z) -> glTF (x, z, -y); metres; z = 0 at the forecourt road',
                'compression': {'blender': 'KHR_draco_mesh_compression (Blender encoder)',
                                'gltf-transform': 'KHR_draco_mesh_compression (gltf-transform draco, edgebreaker, '
                                                  'position 14 / normal 10 / texcoord 12 bits)',
                                'none': 'none'}[method],
                'loader': 'three.js GLTFLoader + DRACOLoader' if method != 'none' else 'three.js GLTFLoader',
                'parts': {}}
    for coll in bpy.context.scene.collection.children:
        if coll.name == 'debug':
            continue
        bpy.ops.object.select_all(action='DESELECT')
        n = 0
        for ob in coll.all_objects:
            ob.select_set(True); n += 1
        if not n:
            continue
        path = outdir / f'{coll.name}.glb'
        kw = dict(filepath=str(path), export_format='GLB', export_yup=True, export_extras=True, export_apply=False,
                  export_cameras=False, export_lights=False, export_materials='EXPORT', use_selection=True)
        if use_blender:
            kw.update(export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6,
                      export_draco_position_quantization=14, export_draco_normal_quantization=10,
                      export_draco_texcoord_quantization=12)
        try:
            bpy.ops.export_scene.gltf(export_gpu_instances=True, **kw)
        except TypeError:
            bpy.ops.export_scene.gltf(**kw)
        raw_mb = round(path.stat().st_size / 1e6, 2)
        if gt:
            tmp = path.with_suffix('.raw.glb')
            path.replace(tmp)
            r = subprocess.run([gt, 'draco', str(tmp), str(path), '--method', 'edgebreaker', '--quantize-position', '14',
                                '--quantize-normal', '10', '--quantize-texcoord', '12'], capture_output=True, text=True)
            if r.returncode != 0 or not path.exists():
                print('gltf-transform failed, keeping the uncompressed file:', r.stderr[-400:])
                tmp.replace(path)
            else:
                tmp.unlink()
        manifest['parts'][coll.name] = dict(file=path.name, objects=n, mb=round(path.stat().st_size / 1e6, 2), mb_uncompressed=raw_mb)
        print('glb', coll.name, manifest['parts'][coll.name])
    (outdir / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=1))
    return manifest


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', nargs='*')
    ap.add_argument('--glb')
    ap.add_argument('--blend')
    ap.add_argument('--render', nargs='*', default=[])
    ap.add_argument('--renders', default=str(TWIN / 'renders'))
    ap.add_argument('--samples', type=int, default=64)
    ap.add_argument('--res', nargs=2, type=int, default=[1600, 1000])
    ap.add_argument('--when', default='2026-06-21T16:30')
    ap.add_argument('--stats')
    ap.add_argument('--glb-split', help='directory for one GLB per collection')
    ap.add_argument('--ground', action='store_true', help='debug: flat ground plane at z = 0')
    a = ap.parse_args(argv)
    sc = reset_scene()
    stats = build_scene(a.only)
    if a.ground:
        g = kit.Geo()
        g.polyn('paving.concrete', [(-400, -400, 0), (400, -400, 0), (400, 400, 0), (-400, 400, 0)], (0, 0, 1))
        g.to_object('ground.temp', collection('debug'))
    sun = sun_and_sky(sc, a.when)
    stats['sun'] = sun
    print(json.dumps(stats, ensure_ascii=False, indent=1))
    if a.glb:
        t0 = time.time()
        export_glb(a.glb)
        stats['glb'] = dict(path=a.glb, mb=round(Path(a.glb).stat().st_size / 1e6, 2), seconds=round(time.time() - t0, 1))
        print('glb', stats['glb'])
    if a.glb_split:
        t0 = time.time()
        stats['glb_split'] = export_split(a.glb_split)
        stats['glb_split']['seconds'] = round(time.time() - t0, 1)
    if a.blend:
        bpy.ops.wm.save_as_mainfile(filepath=str(Path(a.blend).resolve()), compress=True)
        stats['blend'] = dict(path=a.blend, mb=round(Path(a.blend).stat().st_size / 1e6, 2))
    if a.render:
        setup_render(sc, a.samples, tuple(a.res))
        Path(a.renders).mkdir(parents=True, exist_ok=True)
        for name in a.render:
            if name in CALIBRATED and (TWIN / f'{CALIBRATED[name]}.report.json').exists():
                cam = calibrated_camera(sc, name, CALIBRATED[name])
            else:
                loc, look, lens = CAMERAS[name]
                cam = add_camera(sc, name, loc, look, lens)
                sx, sy = CAMERA_SHIFT.get(name, (0.0, 0.0))
                cam.data.shift_x, cam.data.shift_y = sx, sy
            sc.camera = cam
            sc.render.filepath = str(Path(a.renders) / f'{name}.jpg')
            t0 = time.time()
            bpy.ops.render.render(write_still=True)
            print('rendered', name, round(time.time() - t0, 1), 's')
    if a.stats:
        Path(a.stats).write_text(json.dumps(stats, ensure_ascii=False, indent=1))
    return stats


if __name__ == '__main__':
    main(sys.argv[1:])
