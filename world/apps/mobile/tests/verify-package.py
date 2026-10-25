#!/usr/bin/env python3
"""Inspect actual APK/IPA ZIP bytes. Does not assert signature validity or device success."""
import argparse,hashlib,json,pathlib,struct,zipfile
p=argparse.ArgumentParser();p.add_argument('package');p.add_argument('--commit',required=True);p.add_argument('--version',required=True);p.add_argument('--output');a=p.parse_args()
file=pathlib.Path(a.package)
with zipfile.ZipFile(file) as z:
    bad=z.testzip()
    assert bad is None, f'Corrupt ZIP member {bad}'
    names=set(z.namelist())
    if file.suffix=='.apk':
        prefix='assets/public/'
        assert {'AndroidManifest.xml','classes.dex'} <= names, 'Not a compiled APK'
        binary='classes.dex'
        assert z.read(binary).startswith(b'dex\n'), 'Invalid dex header'
        platform='android'
    elif file.suffix=='.ipa':
        apps=sorted({n.split('/')[1] for n in names if n.startswith('Payload/') and '.app/' in n})
        assert len(apps)==1, 'Expected one application bundle'
        prefix='Payload/'+apps[0]+'/public/'
        binary='Payload/'+apps[0]+'/App'
        header=z.read(binary)[:8]
        assert header[:4]==b'\xcf\xfa\xed\xfe', 'Expected real 64-bit Mach-O application'
        assert struct.unpack('<I',header[4:8])[0]==0x0100000c, 'Expected iPhone arm64, not simulator executable'
        platform='ios'
    else: raise AssertionError('Expected .apk or .ipa')
    build=json.loads(z.read(prefix+'build-info.json'))
    assert build['commit']==a.commit, 'Package contains wrong source commit'
    assert build['version']==a.version, 'Package contains wrong web version'
    manifest=json.loads(z.read(prefix+'asset-manifest.json'))
    for item in manifest['files']:
        name=item['path']
        assert not name.startswith('/') and '..' not in name.split('/'), 'Unsafe manifest entry'
        data=z.read(prefix+name)
        assert len(data)==item['bytes'] and hashlib.sha256(data).hexdigest()==item['sha256'], 'Wrong packaged asset '+name
    result={'status':'PASS','platform':platform,'file':file.name,'bytes':file.stat().st_size,'sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'commit':build['commit'],'version':build['version'],'assets':len(manifest['files']),'signature':'NOT_TESTED_BY_THIS_CHECK','physicalDevice':'NOT_TESTED'}
    if a.output: pathlib.Path(a.output).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(result,ensure_ascii=False))
