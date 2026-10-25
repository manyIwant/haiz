import{readFileSync}from'node:fs';import{fileURLToPath}from'node:url';import path from'node:path';import assert from'node:assert/strict';
const home=fileURLToPath(new URL('../',import.meta.url));const read=f=>readFileSync(path.join(home,f),'utf8');const version=JSON.parse(read('package.json')).version;
assert.equal(JSON.parse(read('package-lock.json')).version,version);assert.equal(JSON.parse(read('../../package.json')).version,version);
assert.ok(read('android/app/build.gradle').includes(`versionName "${version}"`));assert.match(read('android/app/build.gradle'),/versionCode 7\b/);
const ios=read('ios/App/App.xcodeproj/project.pbxproj');assert.match(ios,/MARKETING_VERSION = 0\.5\.0;/);assert.match(ios,/CURRENT_PROJECT_VERSION = 7;/);
if(process.env.GITHUB_REF?.startsWith('refs/tags/'))assert.equal(process.env.RELEASE_REF,'haiz-v'+version,'Tag and package version must match');
console.log(JSON.stringify({version,androidVersionCode:7,iosMarketingVersion:'0.5.0',iosBuild:7}));
