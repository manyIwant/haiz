import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Script } from 'node:vm';

const root = resolve(import.meta.dirname, '..');
const read = (name) => readFileSync(resolve(root, name), 'utf8');
const built = (name) => read('pocket/' + name);
const source = (name) => read('app/web/' + name);

test('iPhone installation instructions are the shipped page and lead to the actual app', () => {
  const html = source('install.html');
  assert.equal(built('install.html'), html, 'published page must match Flutter Web source');
  assert.match(html, /href="\.\/\?login=1" id="open-pocket"/);
  assert.match(html, /Safari/);
  assert.match(html, /微信/);
  assert.match(html, /添加到主屏幕/);
  assert.match(html, /在.*Pocket.*页面/);
  assert.match(html, /数据备份与恢复/);
  assert.match(html, /删除网页 App.*数据丢失/);
  assert.match(html, /不能自动读取微信/);
  assert.doesNotMatch(html, /\.ipa.*下载|安装描述文件|企业签名/);
});

test('PWA client is Safari-aware, ships identically, and leaves updates to the user', () => {
  const js = source('pocket-client.js');
  assert.equal(js, built('pocket-client.js'));
  new Script(js);
  assert.match(js, /isSafari/);
  assert.match(js, /MicroMessenger/);
  assert.match(js, /HAIZ_APPLY_UPDATE/);
  assert.match(js, /先在 App 内备份/);
  assert.match(js, /pageshow/);
  assert.doesNotMatch(js, /localStorage\.clear|indexedDB\.deleteDatabase|unregister\(\)/);
});

test('published offline app has a unique, scoped, content-consistent service worker', () => {
  const template = source('pocket-sw.js');
  const sw = built('pocket-sw.js');
  const report = JSON.parse(built('pwa-build.json'));
  const matcher = sw.match(/^const HAIZ_PRECACHE = (\[[^\n]*\]);$/m);
  assert.ok(matcher, 'generated worker must contain its precache list');
  const chosen = JSON.parse(matcher[1]);
  assert.ok(chosen.includes('install.html'));
  assert.ok(chosen.includes('pocket-ui.css'));
  assert.ok(chosen.includes('main.dart.js'));
  assert.ok(!chosen.some(x => /api\/|account\/|user\//i.test(x)));
  const generated = template
    .replace("'__HAIZ_BUILD_ID__'", JSON.stringify(report.version))
    .replace('__HAIZ_PRECACHE__', JSON.stringify(chosen));
  assert.equal(sw, generated, 'published worker must match canonical app/web worker template');
  assert.equal(report.scope, '/pocket/');
  assert.equal(report.offline_asset_count, chosen.length);
  assert.ok(report.offline_asset_bytes > 0 && report.offline_asset_bytes <= 24 * 1024 * 1024);
  assert.equal(report.includes_user_data, false);
  new Script(sw);
});

test('offline install route returns instructions, static styles are intercepted and caches stay versioned', () => {
  const sw = source('pocket-sw.js');
  assert.match(sw, /INSTALL_DOCUMENT/);
  assert.match(sw, /url\.pathname\.endsWith\('\/install\.html'\)/);
  assert.match(sw, /pocket-ui\\\.css/);
  assert.match(sw, /shell\.match\(request/);
  assert.match(sw, /runtime\.match\(request/);
  assert.doesNotMatch(sw, /caches\.match\(request/);
  assert.doesNotMatch(sw, /localStorage|indexedDB|\bcredentials\b\s*:/);
  assert.match(sw, /CACHE_PREFIX = 'haiz-pocket-'/);
  assert.match(sw, /key\.startsWith\(CACHE_PREFIX\)/);
});

test('shipped and source manifests retain the same iOS home-screen identity', () => {
  const manifest = JSON.parse(source('manifest.json'));
  assert.deepEqual(JSON.parse(built('manifest.json')), manifest);
  assert.equal(manifest.id, './');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons.some(i => i.sizes === '192x192'));
  assert.ok(manifest.icons.some(i => i.sizes === '512x512'));
  const html = built('index.html');
  assert.match(html, /<base href="\/pocket\/"/);
  assert.match(html, /apple-mobile-web-app-capable/);
  assert.match(html, /apple-touch-icon/);
});


test('the PWA opens the same Flutter Supabase login as native, not a legacy HTML gateway', () => {
  const main = read('app/lib/main.dart');
  const account = read('app/lib/ui/pocket_account_sheet.dart');
  const auth = read('app/lib/core/pocket_auth.dart');
  assert.match(main, /PocketAccountPage/);
  assert.match(main, /queryParameters\['login'\] == '1'/);
  assert.match(main, /_openAccountLogin\(context\)/);
  assert.match(main, /_showAccountPage && !pocketAuth\.authenticated/);
  assert.match(main, /return PocketAccountPage\(/);
  assert.doesNotMatch(main, /_loginDeepLinkPending/);
  assert.match(account, /fullPage: true/);
  assert.match(account, /onContinueGuest/);
  assert.match(account, /signIn\(/);
  assert.match(account, /signUp\(/);
  assert.match(account, /sendReset\(/);
  assert.match(auth, /signInWithPassword\(/);
  assert.match(auth, /_PrivateAuthStorage\(\)/);
  assert.ok(!auth.includes('localStorage: const EmptyLocalStorage('));
  const webEntry = source('index.html');
  assert.doesNotMatch(webEntry, /lamp-preview|login-production|\/api\/auth\/login/);
  assert.doesNotMatch(source('install.html'), /lamp-preview|login-production|\/api\/auth\/login/);
});
