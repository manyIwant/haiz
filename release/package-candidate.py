"""Publish inputs come only from the successful native QA workflow, never a second rebuild."""
import hashlib,json,os,pathlib,shutil,subprocess,zipfile
root=pathlib.Path('.');out=root/'release-artifacts';out.mkdir(exist_ok=True)
version=json.loads((root/'world/apps/mobile/package.json').read_text())['version'];commit=os.environ['GITHUB_SHA']
inputs=[('candidate/android/app-debug.apk',f'HAIZ-{version}-Android-preview.apk'),('candidate/ios/HAIZ-Study-iOS-unsigned.ipa',f'HAIZ-{version}-iOS-unsigned.ipa')]
reports=[]
for src,name in inputs:
 report=out/(name+'.json')
 subprocess.run(['python','world/apps/mobile/tests/verify-package.py',src,'--commit',commit,'--version',version,'--output',str(report)],check=True)
 shutil.copy2(src,out/name);reports.append(name)
shutil.copy2('candidate/android/signature.txt',out/'ANDROID-SIGNATURE.txt')
subprocess.run(['git','archive','--format=zip','--prefix=HAIZ-WORLD/','--output='+str(out/f'HAIZ-{version}-source.zip'),'HEAD'],check=True)
for src,name in [('release/INSTALL.zh-CN.md','INSTALL.zh-CN.md'),('release/NOTES.zh-CN.md','CHANGELOG.zh-CN.md'),('docs/haiz-audit/QA-RESULTS.md','QA-RESULTS.md')]:shutil.copy2(src,out/name)
with zipfile.ZipFile(out/'native-qa-evidence.zip','w',zipfile.ZIP_DEFLATED) as z:
 for file in (root/'candidate/evidence').rglob('*'):
  if file.is_file():z.write(file,str(file.relative_to(root/'candidate/evidence')))
(out/'BUILD-INFO.json').write_text(json.dumps({'version':version,'commit':commit,'android':'tested preview APK; signing fingerprint in ANDROID-SIGNATURE.txt','ios':'unsigned arm64 IPA; cannot install directly','physicalDevice':'NOT_TESTED','schoolAuthorization':'NOT_GRANTED'},ensure_ascii=False,indent=2)+'\n')
(out/'SHA256SUMS.txt').write_text(''.join(hashlib.sha256(f.read_bytes()).hexdigest()+'  '+f.name+'\n' for f in sorted(out.iterdir()) if f.is_file() and f.name!='SHA256SUMS.txt'))
