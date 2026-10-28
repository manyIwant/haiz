"""Run python3 -I inspect-package.py /absolute/path/to/HAIZ.ClassroomPlugin."""
from pathlib import Path
import hashlib
import json
import sys
import zipfile

root = Path(sys.argv[1]).resolve()
package = root / 'cipx/HAIZ.ClassroomPlugin.cipx'
print('PACKAGE', package)
print('BYTES', package.stat().st_size)
print('SHA256', hashlib.sha256(package.read_bytes()).hexdigest())
md5 = hashlib.md5(package.read_bytes()).hexdigest().upper()
print('MD5', md5)
assert md5 in (root / 'cipx/checksums.md').read_text()
with zipfile.ZipFile(package) as archive:
    bad_member = archive.testzip()
    print('CRC', bad_member)
    assert bad_member is None
    for item in archive.infolist():
        print('ENTRY', item.filename, item.file_size)
    names = set(archive.namelist())
    assert 'HAIZ.ClassroomPlugin.dll' in names
    assert 'manifest.yml' in names
    assert not any('haiz-screen.json' in name or '.env' in name or 'sqlite' in name for name in names)
    assert archive.read('manifest.yml') == (root / 'manifest.yml').read_bytes()
    print('MANIFEST\n' + archive.read('manifest.yml').decode())
    print('RUNTIMECONFIG\n' + archive.read('HAIZ.ClassroomPlugin.runtimeconfig.json').decode())
assets = json.loads((root / 'obj/project.assets.json').read_text())
print('SDK', [name for name in assets['libraries'] if name.startswith('ClassIsland.PluginSdk/')])
print('PASS CRC integrity, MD5 record, manifest match, expected assembly, no haiz-screen config/env/DB')
