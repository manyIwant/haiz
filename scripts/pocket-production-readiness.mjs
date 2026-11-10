#!/usr/bin/env node
/** Evidence-based audit. Never equate desktop/browser CI with iPhone hardware QA. */
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const base = 'https://haiz.space/pocket/';
const source = async p => readFile(resolve(root,p),'utf8');
const [backup, tests, sw, client, importService, auth, pipeline, migration] =
  await Promise.all([
    source('app/lib/ui/pocket_backup_sheet.dart'),
    source('app/test/personal_backup_test.dart'),
    source('app/web/pocket-sw.js'),
    source('app/web/pocket-client.js'),
    source('app/lib/domain/notice_import_service.dart'),
    source('app/lib/core/pocket_auth.dart'),
    source('.github/workflows/pocket-autopublish.yml'),
    source('supabase/migrations/202610310001_pocket_snapshots.sql')
  ]);
const checks = [];
const add = (id, title, status, evidence, remaining) =>
  checks.push({id,title,status,evidence,remaining});

add('safari-file', 'Safari 文件下载与导入',
  backup.includes('FilePicker.saveFile') && backup.includes('FilePicker.pickFile') ?
    'device-required' : 'blocked',
  'Source uses file_picker 13 download and picker; tested backup parsing is available',
  'Real iPhone: export JSON to Files, locate saved file, import and compare tasks/notes. A returned URI is not proof of saved file.');
add('standalone-storage','主屏幕模式持久化',
  sw.includes("addEventListener('fetch'") && client.includes('serviceWorker.register') ?
    'device-required' : 'blocked',
  'Scoped service worker and guest namespace exist',
  'Real iPhone: test installed standalone launch/restart, Safari-vs-PWA data isolation, low-storage eviction and offline reload.');
add('eviction-recovery','网站数据被清理后的恢复',
  tests.includes('storage reset') && tests.includes('mergeGuestBackup') ?
    'device-required' : 'blocked',
  'Dart tests cover file recovery after storage reset, checksum and account isolation',
  'Real iPhone: test on a disposable profile; save backup outside Safari, clear app website data, reinstall and import. Compare task IDs, notes, courses, focus.');
const cloudBuildConfigured = pipeline.includes('--dart-define=HAIZ_SUPABASE_URL=') &&
  pipeline.includes('--dart-define=HAIZ_SUPABASE_PUBLISHABLE_KEY=');
add('cloud-sync','生产多设备云同步',
  cloudBuildConfigured ? 'environment-required' : 'blocked',
  'RLS and CAS source exist: ' + (migration.includes('auth.uid()') &&
     auth.includes(".eq('version', _version)")),
  'Configure production Supabase URL and publishable key in Actions variables; apply migration. Then test two real users/devices, concurrent edits, stale-version refusal, reload and logout. No credentials observed in current repository Actions variables.');
const pushHandler=sw.includes("addEventListener('push'");
const pushSubscribe=client.includes('pushManager.subscribe');
add('web-push','iPhone 主屏幕推送',
  pushHandler && pushSubscribe ? 'environment-required' : 'blocked',
  'Service worker push event: '+pushHandler+'; opt-in subscription: '+pushSubscribe,
  'Need authenticated subscription endpoint, VAPID server, schedules, unsubscribe, privacy safeguards, iOS 16.4+ installed app with permission and closed-app notification test.');
const webOcrEnabled=!/if\s*\(kIsWeb\)\s*\{\s*throw UnsupportedError/.test(importService);
add('web-ocr','Safari 本地截图 OCR',
  webOcrEnabled ? 'device-required' : 'blocked',
  webOcrEnabled ? 'No explicit Web OCR rejection detected' :
  'Current NoticeImportService rejects screenshot OCR on Flutter Web',
  'Implement tested on-device Chinese+English OCR with trusted models and no image upload. Verify offline model availability, size, quality, memory and real Safari compatibility.');

let live=null;
if(process.argv.includes('--live')){
 try{
  const rows=await Promise.all(['','manifest.json','pwa-build.json','pocket-sw.js']
    .map(async p=>{
      const control=new AbortController();
      const timeout=setTimeout(()=>control.abort(),12000);
      try{
        const response=await fetch(new URL(p,base),{signal:control.signal,cache:'no-store'});
        const data=response.ok?await response.text():'';
        return {path:p||'/',status:response.status,bytes:data.length,
          ...(p==='pwa-build.json'&&response.ok?{build:JSON.parse(data)}:{})};
      }finally{clearTimeout(timeout);}
    }));
  live={checkedAt:new Date().toISOString(),rows};
 }catch(e){live={checkedAt:new Date().toISOString(),error:String(e).slice(0,230)};}
}
const report={generatedAt:new Date().toISOString(),target:base,
 scope:'Source audit and CI only; NOT an iPhone hardware or live backend validation',
 checks,counts:Object.fromEntries(['pass','device-required','environment-required','blocked']
 .map(s=>[s,checks.filter(x=>x.status===s).length])),
 ...(live?{live}:{})};
const lines=['# HAIZ Pocket production acceptance','',
 'Generated: '+report.generatedAt,'',
 '> Green CI never substitutes for a real iPhone or production backend tests.','',
 '| Area | Verdict |','|---|---|',
 ...checks.map(c=>'| '+c.title+' | '+c.status+' |'),'',
 ...checks.flatMap(c=>['## '+c.title,'','Status: '+c.status,'',
 'Evidence: '+c.evidence,'','Outstanding: '+c.remaining,'']),
 ...(live?['## Public HTTPS probe','',JSON.stringify(live,null,2),'']:[])];
const out=resolve(root,'production-acceptance-output');
await mkdir(out,{recursive:true});
await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');
await writeFile(resolve(out,'report.md'),lines.join('\n')+'\n');
console.log(lines.join('\n'));
if(process.argv.includes('--strict')&&checks.some(c=>c.status!=='pass')){
 console.error('PRODUCTION HOLD: real-world evidence is missing');
 process.exitCode=1;
}
