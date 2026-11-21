"""Check exported asset contracts without requiring Blender or third-party packages."""
import hashlib
import json
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / 'source/20261121124835_b26256ec.glb'
SHA = '85a0f622739ded8194260211b876ef6ec98f8bab6eb592ed75ae51d3e48c7d67'
CLIPS = {'Idle', 'Walk', 'Run', 'Turn Left', 'Turn Right', 'Walk Stop', 'Start Walking'}
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == SHA


def read(path):
    data = path.read_bytes()
    magic, version, size, json_size, kind = struct.unpack_from('<4sIII4s', data)
    assert (magic, version, size, kind) == (b'glTF', 2, len(data), b'JSON')
    return json.loads(data[20:20 + json_size])


for tier, minimum, maximum in [('near', 40000, 80000), ('mid', 15000, 30000), ('far', 3000, 10000)]:
    path = ROOT / 'models' / f'student-{tier}.glb'
    assert path.is_file(), f'Missing export: {path}'
    model = read(path)
    primitives = [p for mesh in model['meshes'] for p in mesh['primitives']]
    triangles = sum(model['accessors'][p['indices']]['count'] // 3 for p in primitives)
    assert minimum <= triangles <= maximum, (tier, triangles)
    assert len(primitives) == 1, 'Expected a single character draw call'
    attrs = primitives[0]['attributes']
    assert {'JOINTS_0', 'WEIGHTS_0', 'TEXCOORD_0', 'POSITION', 'NORMAL'} <= attrs.keys()
    assert len(model['skins']) == 1 and len(model['skins'][0]['joints']) >= 20
    animations = {a['name']: len(a['channels']) for a in model['animations']}
    assert CLIPS <= animations.keys() and min(animations.values()) >= 2, animations
    material = model['materials'][primitives[0]['material']]
    assert {'normalTexture', 'occlusionTexture', 'pbrMetallicRoughness'} <= material.keys()
    assert {'baseColorTexture', 'metallicRoughnessTexture'} <= material['pbrMetallicRoughness'].keys()
    print(tier, triangles, path.stat().st_size, animations)
